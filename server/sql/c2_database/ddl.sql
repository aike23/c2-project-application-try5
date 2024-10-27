use c2_database;

--main
DROP TABLE IF EXISTS `computer`;
DROP TABLE IF EXISTS `app`;
DROP TABLE IF EXISTS `log`;
DROP TABLE IF EXISTS `pending`;


-- --------------------------------------------------------------------------------------------------
-- Table computer
-- --------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `computer` (
    `computer_id` VARCHAR(128) NOT NULL PRIMARY KEY,
    `os_name` VARCHAR(255),         -- https://stackoverflow.com/questions/8683895/how-do-i-determine-the-current-operating-system-with-node-js
    `os_ver` VARCHAR(255),          -- https://nodejs.org/api/os.html
    `location` VARCHAR(255), -- returns 'SWE'?    https://hackernoon.com/how-to-find-location-using-ip-address-in-nodejs
    `ip_adress` VARCHAR(255)
    -- installed apps & activity date use computer id
);

-- --------------------------------------------------------------------------------------------------
-- Table app
-- --------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `app` (
    `row_id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `computer_id` VARCHAR(128) NOT NULL,
    `applications` VARCHAR(255),

    CONSTRAINT fkey_computer_app FOREIGN KEY (`computer_id`) REFERENCES `computer`(`computer_id`) ON DELETE CASCADE

);

-- --------------------------------------------------------------------------------------------------
-- Table log
-- --------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `log` (
    `row_id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `computer_id` VARCHAR(128) NOT NULL,
    `status` VARCHAR(10),
    `date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------------------------------------
-- Table pending
-- --------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pending` (
    `row_id` INT AUTO_INCREMENT PRIMARY KEY,
    `requested_computer_id` VARCHAR(128) NOT NULL,
    `date_requested` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- --------------------------------------------------------------------------------------------------
-- PROCEDURES
-- --------------------------------------------------------------------------------------------------

-- ADD TO PENDING  =========================================================
DROP PROCEDURE IF EXISTS add_to_pending;
DELIMITER ;;
CREATE PROCEDURE add_to_pending(
    a_id VARCHAR(128),
    OUT res VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pending WHERE requested_computer_id = a_id) THEN
        INSERT INTO pending (requested_computer_id)
        VALUES (a_id);
        SET res = "Success";
    ELSE
        SET res=  "Request already sent";
    END IF;
END;;
DELIMITER ;

-- ACCEPTED PENDING REQUEST =========================================================
DROP PROCEDURE IF EXISTS accepted_pending_request;
DELIMITER ;;
CREATE PROCEDURE accepted_pending_request(
    a_id VARCHAR(128),
    OUT res VARCHAR(255)
)
BEGIN
    IF EXISTS (SELECT 1 FROM pending WHERE requested_computer_id = a_id) THEN
        IF NOT EXISTS (SELECT 1 FROM computer WHERE computer_id = a_id) THEN
            INSERT INTO computer (computer_id) VALUES (a_id);
            SET res = "Success";
        ELSE
            SET res = "Computer already added";
        END IF;
        DELETE FROM pending WHERE requested_computer_id = a_id;
    ELSE
        SET res = "Operation failed";
    END IF;
END;;
DELIMITER ;


-- CHECK IF CONNCETED  =========================================================
DROP PROCEDURE IF EXISTS am_i_connected;
DELIMITER ;;
CREATE PROCEDURE am_i_connected(
    a_id VARCHAR(128),
    OUT res VARCHAR(255)
)
BEGIN
    IF EXISTS (SELECT * FROM computer WHERE computer_id = a_id) THEN
        SET res = "yes";
    ELSE
        SET res = "no";
    END IF;
END;;
DELIMITER ;

-- CHECK IF IN PENDING  =========================================================
DROP PROCEDURE IF EXISTS am_i_pending;
DELIMITER ;;
CREATE PROCEDURE am_i_pending(
    a_id VARCHAR(128),
    OUT res VARCHAR(255)
)
BEGIN
    IF EXISTS (SELECT * FROM pending WHERE requested_computer_id = a_id) THEN
        SET res = "yes";
    ELSE
        SET res = "no";
    END IF;
END;;
DELIMITER ;


-- ADD COMPUTER INFO  =========================================================
DROP PROCEDURE IF EXISTS add_computer_info;
DELIMITER ;;
CREATE PROCEDURE add_computer_info(
    a_id VARCHAR(128),
    a_platform VARCHAR (255),
    a_release VARCHAR (255),
    a_geolocation VARCHAR (255),
    a_ip VARCHAR (255),
    OUT res VARCHAR(255)
)
BEGIN
    IF EXISTS (SELECT 1 FROM computer WHERE computer_id = a_id) THEN
        UPDATE computer
        SET os_name = a_platform, os_ver = a_release, `location` = a_geolocation, ip_adress = a_ip
        WHERE computer_id = a_id;
        SET res = 'Update Success';
    ELSE
        SET res = 'Update Fail';
    END IF;
END;;
DELIMITER ;



-- --------------------------------------------------------------------------------------------------
-- TRIGGERS
-- --------------------------------------------------------------------------------------------------
