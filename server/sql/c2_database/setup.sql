DROP DATABASE IF EXISTS c2_database;

CREATE DATABASE c2_database;

USE c2_database;

CREATE USER IF NOT EXISTS 'user'@'%'
    IDENTIFIED BY 'pass'
;
GRANT ALL PRIVILEGES ON c2_database.* TO 'user'@'%';

source ./ddl.sql