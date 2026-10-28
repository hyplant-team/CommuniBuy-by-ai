@echo off
cd /D "%~dp0"
set DB_URL=jdbc:mysql://root:fx5fgj7l@dbconn.sealoshzh.site:41973/DB_1
set PAYMENT_MODE=simulator
set PAYMENT_SIM_SECRET=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
java -Dserver.address=127.0.0.1 -Dserver.port=8443 -jar communibuy.jar
timeout /T 3
