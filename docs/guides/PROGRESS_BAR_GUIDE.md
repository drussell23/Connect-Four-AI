# Progress Bar Feature Guide

## Overview

The Connect Four AI project now includes visual progress bars for comprehensive service management operations. This provides real-time feedback during time-consuming operations like starting, stopping, or restarting all services.

## Features

- **Real-time Progress Tracking**: Visual progress bar showing percentage completion
- **Time Estimation**: Shows elapsed time and estimated time remaining (ETA)
- **Phase Indicators**: Clear messaging about what operation is currently running
- **Sub-progress Updates**: Smooth progress updates even during waiting periods
- **Color-coded Output**: Easy-to-read status indicators

## Available Commands

### With Progress Bar

```bash
# Restart all services with progress bar
npm run restart:all:progress

# Stop all services with progress bar
npm run stop:all:progress

# Start all services with progress bar
npm run start:all:progress
```

### Without Progress Bar (Original)

```bash
# Original commands still available
npm run restart:all:comprehensive
npm run stop:all:comprehensive
npm run start:all:comprehensive
```

## Progress Bar Display

The progress bar shows:

```
[██████████████████████████▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒]  52% | Elapsed: 00:23 | ETA: 00:21
📋 Starting Backend Service...
```

- `█` - Completed portion
- `▒` - Remaining portion
- Percentage - Current progress
- Elapsed - Time since operation started
- ETA - Estimated time to completion
- Status message - Current operation

## Implementation Details

### Progress Phases

#### Stop Phase (20 steps total)
1. Initialize shutdown (1 step)
2. Stop each service gracefully (2 steps × 5 services = 10 steps)
3. Clean up processes (5 steps)
4. Verify ports (2 steps)
5. Clean temporary files (2 steps)

#### Start Phase (25 steps total)
1. Prepare environment (4 steps)
2. Start each service (3 steps × 5 services = 15 steps)
3. Health checks and verification (6 steps)

#### Combined Restart (45 steps total)
- Stop phase: 20 steps
- Start phase: 25 steps

### Time Estimates

Typical execution times:

- **Stop All**: 10-20 seconds
- **Start All**: 30-40 seconds
- **Restart All**: 40-60 seconds

Times vary based on:
- Current system load
- Service response times
- Number of services already running
- Health check response times

## Demo

Run the progress bar demo to see it in action:

```bash
./demo-progress.sh
```

## Technical Architecture

### Core Progress Bar Module

Located in `scripts/progress-bar.sh`, provides:

- `update_progress()` - Update progress with current step
- `draw_progress_bar()` - Render the visual progress bar
- `format_time()` - Format seconds to MM:SS
- `complete_progress()` - Mark operation as complete
- `show_spinner_progress()` - Show spinner for indeterminate operations

### Integration Pattern

```bash
# Source the progress utilities
source scripts/progress-bar.sh

# Define total steps
TOTAL_STEPS=20

# Update progress
update_progress 5 $TOTAL_STEPS "Processing step 5..."

# Complete
complete_progress
```

## Customization

### Adjusting Progress Bar Width

Edit `scripts/progress-bar.sh`:

```bash
local width=50  # Change this value (default: 50 characters)
```

### Changing Progress Characters

```bash
printf "%${filled}s" | tr ' ' '█'   # Filled character
printf "%${empty}s" | tr ' ' '▒'    # Empty character
```

### Adding New Operations

To add progress tracking to new scripts:

1. Source the progress bar utilities
2. Define total steps for your operation
3. Call `update_progress` at key points
4. Call `complete_progress` when done

## Troubleshooting

### Progress Bar Not Showing

- Ensure terminal supports Unicode characters
- Check terminal width (minimum 80 characters recommended)
- Verify `scripts/progress-bar.sh` is executable

### Incorrect Time Estimates

- ETA improves as more steps complete
- First few steps may show inaccurate estimates
- Consistent step timing improves accuracy

### Terminal Compatibility

The progress bar uses ANSI escape codes and Unicode. Compatible with:
- macOS Terminal
- iTerm2
- Most Linux terminals
- Windows Terminal
- Git Bash

## Benefits

1. **User Experience**: No more wondering if the script is frozen
2. **Time Awareness**: Know how long operations will take
3. **Debug Friendly**: Clear indication of which step failed
4. **Professional**: Polished appearance for deployment scripts
5. **Informative**: Real-time feedback on system operations