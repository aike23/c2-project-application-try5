# C2 application
 A beginner programmer's take on a c2 application
***
## Intro
Hello, my namy is Ari. This is a project for the course PA1414 at Blekinge Tekniska Högskolan, a college in Sweden.

## How to install and run
Download the .7z file and open the "main" folder within it. Inside, there are two important folders, "server" and "client", and "node_modules". These three must always be in the same folder, as "client" and "server" share some modules. Due to time constrains, I could not separate "node_modules" into client's and server's own separate folder. 

To run client and server apps, Node js must be installed. [Click here to see how](https://nodejs.org/en/learn/getting-started/how-to-install-nodejs). 

Once Node js is installed, go to the relevant filepath of either file and type in either node cli for client, or node index for server. 

For example, `C:\Users\[USERNAME]\Desktop\main\client\ node cli` 

**IMPORTANT:** THE DATABASE IS NOT CREATED AUTOMATICALLY. 
[You have to have mariadb installed and running](https://mariadb.com/kb/en/getting-installing-and-upgrading-mariadb/). Once that is done, create a database called c2_database, and then run setup.ddl within `main\server\sql\c2_database` with `mariadb c2_database < setup.sql` in a terminal environment that works with mariadb. 

## Functionality

### [You can view a demonstration here](https://youtu.be/wn8xiAEMAG4?t=175)

### Web GUI
Once index.js is running, you can go to the web gui via [localhost:1337](http://localhost:1337/)

At the top, you'll find the main menu for navigation

### Client CLI
Once cli.js is running, a menu is displayed with relevant functionalities.

When the client is not part of the c2 database. Only two options are shown.

When the client is part of the database, that is the client has been accepted in the web gui, the client menu then displays the rest of the menu.

Entering "2" starts a heartbeat with the server. This is important in order to display the server status.

Entering "3" enumerates all info given to the server.

Entering "4" hides the terminal. You can bring it back using ctrl+shift+alt+Q. Due to the way the npm module which hides and shows the terminal works, it doesn't appear on top. If you press ctrl+shift+alt+Q and nothing pops up, check behind any open windows, and it should be there.

Entering "5" along with a path to a file sends the file to the server. For example, `5 C:\Users\[USERNAME]\Desktop\file.txt` will send a file named file.txt from the desktop. 
