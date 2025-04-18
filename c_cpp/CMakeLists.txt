cmake_minimum_required(VERSION 3.10)
project(ConnectFourGame LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Since this file is in c_cpp/, all paths below are relative to c_cpp/
add_executable(connect4
  src/cpp/main.cpp    # <-- no extra c_cpp/ prefix
  src/cpp/Game.cpp
)

target_include_directories(connect4
  PRIVATE
    ${CMAKE_SOURCE_DIR}/src/cpp    # for Game.hpp
    ${CMAKE_SOURCE_DIR}/include    # if you have shared headers here
)
