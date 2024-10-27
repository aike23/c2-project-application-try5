#include <condition_variable>
#include <mutex>
#include <napi.h>
#include <queue>

#define TRAY_WINAPI 1

// Should always come last, otherwise printf error.
#include "tray.h"

struct ItemMap {
  Napi::Reference<Napi::Symbol> id;
  tray_menu *item;
};

// Global variables
Napi::ThreadSafeFunction trayCallback;
std::mutex mtx;
std::condition_variable cvEventQueue;
std::queue<tray_menu *> eventQueue;

tray nodeTray;
std::vector<tray_menu> items;
std::vector<ItemMap> imap;

// Communication between slow async worker and Exit()
std::condition_variable cvExit;
bool hasFinished = false;

void onClick(tray_menu *item) {
  std::lock_guard<std::mutex> lock(mtx);
  eventQueue.push(item);
  cvEventQueue.notify_one();
}

void processEvents(Napi::Env env, bool &cancelEventProcessing) {
  while (true) {
    std::unique_lock<std::mutex> lock(mtx);
    cvEventQueue.wait(lock, [&cancelEventProcessing] {
      return cancelEventProcessing || !eventQueue.empty();
    });

    if (cancelEventProcessing) {
      return;
    }

    while (!eventQueue.empty()) {
      tray_menu *item = eventQueue.front();
      eventQueue.pop();

      auto it =
          std::find_if(imap.begin(), imap.end(),
                       [item](const ItemMap &im) { return im.item == item; });

      if (it != imap.end()) {
        int index = std::distance(imap.begin(), it);
        trayCallback.BlockingCall(
            &index, [](Napi::Env env, Napi::Function jsCallback, int *data) {
              auto &mapEntry = imap[*data];
              auto obj = Napi::Object::New(env);
              obj.Set("id", mapEntry.id.Value());
              obj.Set("text", mapEntry.item->text);
              obj.Set("enabled", !mapEntry.item->disabled);
              obj.Set("checked", mapEntry.item->checked);
              jsCallback.Call({obj});
            });
      }
    }
  }
}

class TrayInitWorker : public Napi::AsyncWorker {
public:
  TrayInitWorker(Napi::Env env, bool &cancelTrayLoop)
      : Napi::AsyncWorker(env), cancelTrayLoop(cancelTrayLoop) {}

  void Execute() override {
    tray_init(&nodeTray);
    while (!cancelTrayLoop && tray_loop(1) == 0) {
    }

    hasFinished = true;
    cvExit.notify_all();
  }
private:
  bool &cancelTrayLoop;
};
bool cancelTrayLoop = false;

class EventProcessingWorker : public Napi::AsyncWorker {
public:
  EventProcessingWorker(Napi::Env env, bool &cancelEventProcessing)
      : Napi::AsyncWorker(env), cancelEventProcessing(cancelEventProcessing) {}

  void Execute() override { processEvents(Env(), cancelEventProcessing); }

private:
  bool &cancelEventProcessing;
};
bool cancelEventProcessing = false;

Napi::Value Create(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();

  if (info.Length() < 4) {
    Napi::TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  std::string icon = info[0].As<Napi::String>();
  std::string tooltip = info[1].As<Napi::String>();
  Napi::Array menuItems = info[2].As<Napi::Array>();
  Napi::Function callback = info[3].As<Napi::Function>();

  items.resize(menuItems.Length() + 1);
  imap.resize(menuItems.Length());

  for (uint32_t i = 0; i < menuItems.Length(); i++) {
    Napi::Object item = menuItems.Get(i).As<Napi::Object>();
    items[i].text =
        strdup(item.Get("text").As<Napi::String>().Utf8Value().c_str());
    items[i].cb = onClick;
    items[i].context = nullptr;
    items[i].submenu = nullptr;
    items[i].disabled = !item.Get("enabled").As<Napi::Boolean>();
    items[i].checked = item.Get("checked").As<Napi::Boolean>();

    // I'm don't know why we have to use `Persistent` because as long as the
    // event emitter instance exists in memory, it should hold references to all
    // items and those in turn to their ids but... the code simply doesn't work
    // without it.
    imap[i].id = Napi::Persistent(item.Get("id").As<Napi::Symbol>());
    imap[i].item = &items[i];
  }

  items[menuItems.Length()].text = nullptr;

  nodeTray.icon = strdup(icon.c_str());
  nodeTray.tooltip = strdup(tooltip.c_str());
  nodeTray.menu = items.data();

  trayCallback =
      Napi::ThreadSafeFunction::New(env, callback, "TrayCallback", 0, 1);

  TrayInitWorker *initWorker = new TrayInitWorker(env, cancelTrayLoop);
  initWorker->Queue();

  EventProcessingWorker *eventWorker =
      new EventProcessingWorker(env, cancelEventProcessing);
  eventWorker->Queue();

  return env.Undefined();
}

Napi::Value Update(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  Napi::Object updateObj = info[0].As<Napi::Object>();
  Napi::Value id = updateObj.Get("id");

  auto it = std::find_if(imap.begin(), imap.end(), [&id](const ItemMap &im) {
    return im.id.Value().StrictEquals(id);
  });

  if (it != imap.end()) {
    tray_menu *item = it->item;
    delete[] item->text;
    item->text =
        strdup(updateObj.Get("text").As<Napi::String>().Utf8Value().c_str());
    item->disabled = !updateObj.Get("enabled").As<Napi::Boolean>();
    item->checked = updateObj.Get("checked").As<Napi::Boolean>();

    tray_update(&nodeTray);
  } else {
    Napi::Error::New(env, "Tray item for provided id could not be found.")
        .ThrowAsJavaScriptException();
  }

  return env.Undefined();
}

Napi::Value UpdateIcon(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();

  nodeTray.icon = strdup(info[0].As<Napi::String>().Utf8Value().c_str());
  tray_update(&nodeTray);

  return env.Undefined();
}

Napi::Value UpdateTooltip(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();

  nodeTray.tooltip = strdup(info[0].As<Napi::String>().Utf8Value().c_str());
  tray_update(&nodeTray);

  return env.Undefined();
}

Napi::Value Exit(const Napi::CallbackInfo &info) {
  cancelEventProcessing = true;
  cancelTrayLoop = true;
  cvEventQueue.notify_one();
  trayCallback.Release();

  tray_exit();

  // std::unique_lock<std::mutex> lock(mtx);
  // cvExit.wait(lock, [] { return hasFinished; });

  return info.Env().Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("create", Napi::Function::New(env, Create));
  exports.Set("update", Napi::Function::New(env, Update));
  exports.Set("updateIcon", Napi::Function::New(env, UpdateIcon));
  exports.Set("updateTooltip", Napi::Function::New(env, UpdateTooltip));
  exports.Set("exit", Napi::Function::New(env, Exit));
  return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init)
