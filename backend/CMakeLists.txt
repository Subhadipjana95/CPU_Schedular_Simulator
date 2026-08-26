cmake_minimum_required(VERSION 3.16)
project(cpu_scheduler_server)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ── Executable ────────────────────────────────────────────────────────────────
add_executable(server
    main.cpp
    src/fcfs.cpp
    src/sjf.cpp
    src/srtf.cpp
    src/round_robin.cpp
    src/priority.cpp
)

# include/ for our headers, third_party/ for nlohmann/json.hpp and httplib.h
target_include_directories(server PRIVATE include third_party)

# On Windows / MinGW, link Winsock libraries required for networking
if(WIN32)
    target_link_libraries(server PRIVATE ws2_32 crypt32)
endif()
