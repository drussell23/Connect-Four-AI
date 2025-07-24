#!/bin/bash

# Progress Bar Utility Functions
# Usage: source scripts/progress-bar.sh

# Initialize progress tracking
PROGRESS_CURRENT=0
PROGRESS_TOTAL=100
PROGRESS_START_TIME=$(date +%s)

# Function to draw progress bar
draw_progress_bar() {
    local current=$1
    local total=$2
    local width=50
    local percentage=$((current * 100 / total))
    local filled=$((percentage * width / 100))
    local empty=$((width - filled))
    
    # Calculate elapsed time and ETA
    local current_time=$(date +%s)
    local elapsed=$((current_time - PROGRESS_START_TIME))
    local eta=0
    if [ $current -gt 0 ]; then
        eta=$(( (elapsed * total / current) - elapsed ))
    fi
    
    # Format time displays
    local elapsed_str=$(format_time $elapsed)
    local eta_str=$(format_time $eta)
    
    # Build the bar
    printf "\r["
    printf "%${filled}s" | tr ' ' '█'
    printf "%${empty}s" | tr ' ' '▒'
    printf "] %3d%% | Elapsed: %s | ETA: %s " "$percentage" "$elapsed_str" "$eta_str"
}

# Function to format seconds to MM:SS
format_time() {
    local seconds=$1
    local minutes=$((seconds / 60))
    local secs=$((seconds % 60))
    printf "%02d:%02d" $minutes $secs
}

# Function to update progress
update_progress() {
    local step=$1
    local total=$2
    local message=$3
    
    PROGRESS_CURRENT=$step
    PROGRESS_TOTAL=$total
    
    # Clear line and draw progress bar
    printf "\033[2K"
    draw_progress_bar $PROGRESS_CURRENT $PROGRESS_TOTAL
    
    # Add message if provided
    if [ -n "$message" ]; then
        printf "\n📋 %s\n" "$message"
    fi
}

# Function to complete progress
complete_progress() {
    update_progress $PROGRESS_TOTAL $PROGRESS_TOTAL ""
    printf "\n"
}

# Function to show spinner with progress
show_spinner_progress() {
    local pid=$1
    local message=$2
    local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0
    
    while kill -0 $pid 2>/dev/null; do
        i=$(( (i+1) %10 ))
        printf "\r${spin:$i:1} %s" "$message"
        sleep 0.1
    done
    printf "\r✓ %s\n" "$message"
}