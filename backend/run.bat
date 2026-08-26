@echo off
echo Building CPU Scheduler Backend...
if not exist build mkdir build
cd build
g++ -std=c++17 -O2 -I..\include -I..\third_party ..\main.cpp ..\src\fcfs.cpp ..\src\sjf.cpp ..\src\srtf.cpp ..\src\round_robin.cpp ..\src\priority.cpp -o server.exe -lws2_32
if %ERRORLEVEL% equ 0 (
    echo.
    echo ========================================
    echo Build successful: backend\build\server.exe
    echo Starting server on http://localhost:8080 ...
    echo ========================================
    .\server.exe
) else (
    echo.
    echo [ERROR] Build failed.
)
