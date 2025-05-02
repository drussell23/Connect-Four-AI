cmake_minimum_required(VERSION 3.10)
project(ConnectFourGame LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# -------------------------------
# Sources
# -------------------------------
file(GLOB_RECURSE CPP_SOURCES
  "${CMAKE_CURRENT_SOURCE_DIR}/src/cpp/main.cpp"
  "${CMAKE_CURRENT_SOURCE_DIR}/src/cpp/core/*.cpp"
  "${CMAKE_CURRENT_SOURCE_DIR}/src/cpp/players/*.cpp"
  "${CMAKE_CURRENT_SOURCE_DIR}/src/cpp/ai/**/*.cpp"
  "${CMAKE_CURRENT_SOURCE_DIR}/src/cpp/util/*.cpp"
)

# -------------------------------
# Target
# -------------------------------
add_executable(connect4 ${CPP_SOURCES})

# -------------------------------
# Include Paths
# -------------------------------
# Public headers (shared, C code if any)
target_include_directories(connect4 PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}/include
)

# C++ “public” headers and module headers
# We add the top-level src/cpp so that subdirs (core/, players/, ai/, util/) resolve correctly.
target_include_directories(connect4 PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}/src/cpp
)

# If you have headers in subfolders and include them with relative paths,
# you can also add each folder explicitly:
# target_include_directories(connect4 PRIVATE
#   ${CMAKE_CURRENT_SOURCE_DIR}/src/cpp/core
#   ${CMAKE_CURRENT_SOURCE_DIR}/src/cpp/players
#   ${CMAKE_CURRENT_SOURCE_DIR}/src/cpp/ai
#   ${CMAKE_CURRENT_SOURCE_DIR}/src/cpp/util
# )

# -------------------------------
# Libraries
# -------------------------------
# e.g. pthread, math, etc.
# target_link_libraries(connect4 PRIVATE pthread)
