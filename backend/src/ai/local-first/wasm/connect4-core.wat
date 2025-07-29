;; WebAssembly Text Format for Connect Four AI Core
;; High-performance minimax with alpha-beta pruning

(module
  ;; Memory: 1 page = 64KB
  (memory (export "memory") 1)
  
  ;; Constants
  (global $ROWS i32 (i32.const 6)) ;; 6 rows
  (global $COLS i32 (i32.const 7)) ;; 7 columns
  (global $EMPTY i32 (i32.const 0)) ;; Empty cell
  (global $RED i32 (i32.const 1)) ;; Red player
  (global $YELLOW i32 (i32.const 2)) ;; Yellow player
  (global $WIN_LENGTH i32 (i32.const 4)) ;; 4 in a row to win
  
  ;; Global variables
  (global $nodes_searched (mut i32) (i32.const 0)) ;; Nodes searched
  (global $transposition_table_size i32 (i32.const 8192)) ;; Transposition table size
  
  ;; Allocate board (42 cells * 4 bytes = 168 bytes)
  (func $allocateBoard (export "allocateBoard") (result i32) ;; Allocate board (no-op)
    (i32.const 0) ;; Return 0 for now (no-op)
  )
  
  ;; Free board (no-op in this simple implementation)
  (func $freeBoard (export "freeBoard") (param $board i32) ;; Free board (no-op)
  
  ;; Get nodes searched
  (func $getNodesSearched (export "getNodesSearched") (result i32) ;; Get nodes searched
    (global.get $nodes_searched) ;; Return nodes searched
  )
  
  ;; Reset nodes counter
  (func $resetNodesSearched (export "resetNodesSearched") ;; Reset nodes counter
    (global.set $nodes_searched (i32.const 0)) ;; Set nodes searched to 0
  )
  
  ;; Get cell value
  (func $getCell (param $board i32) (param $row i32) (param $col i32) (result i32) ;; Get cell value
    (i32.load ;; Load cell value from board
      (i32.add ;; Add board address, row, and column
        (local.get $board) ;; Board address
        (i32.mul ;; Multiply row by columns
          (i32.add ;; Add row and column
            (i32.mul (local.get $row) (global.get $COLS)) ;; Multiply row by columns
            (local.get $col) ;; Column
          )
          (i32.const 4) ;; 4 bytes per cell
        )
      )
    )
  )
  
  ;; Set cell value
  (func $setCell (param $board i32) (param $row i32) (param $col i32) (param $value i32)
    (i32.store
      (i32.add
        (local.get $board)
        (i32.mul
          (i32.add
            (i32.mul (local.get $row) (global.get $COLS))
            (local.get $col)
          )
          (i32.const 4)
        )
      )
      (local.get $value)
    )
  )
  
  ;; Check if column is valid
  (func $isValidMove (param $board i32) (param $col i32) (result i32)
    (i32.eq
      (call $getCell (local.get $board) (i32.const 0) (local.get $col))
      (global.get $EMPTY)
    )
  )
  
  ;; Make move
  (func $makeMove (param $board i32) (param $col i32) (param $player i32) (result i32)
    (local $row i32)
    (local.set $row (i32.const 5))
    
    (block $found
      (loop $search
        (br_if $found
          (i32.eq
            (call $getCell (local.get $board) (local.get $row) (local.get $col))
            (global.get $EMPTY)
          )
        )
        (local.set $row (i32.sub (local.get $row) (i32.const 1)))
        (br_if $search (i32.ge_s (local.get $row) (i32.const 0)))
      )
    )
    
    (call $setCell (local.get $board) (local.get $row) (local.get $col) (local.get $player))
    (local.get $row)
  )
  
  ;; Undo move
  (func $undoMove (param $board i32) (param $row i32) (param $col i32)
    (call $setCell (local.get $board) (local.get $row) (local.get $col) (global.get $EMPTY))
  )
  
  ;; Check winner from position
  (func $checkWinnerAt (param $board i32) (param $row i32) (param $col i32) (result i32)
    (local $player i32)
    (local $count i32)
    (local $r i32)
    (local $c i32)
    (local $dr i32)
    (local $dc i32)
    (local $dir i32)
    
    (local.set $player (call $getCell (local.get $board) (local.get $row) (local.get $col)))
    (if (i32.eq (local.get $player) (global.get $EMPTY))
      (return (i32.const 0))
    )
    
    ;; Check all 4 directions: horizontal, vertical, diagonal-down, diagonal-up
    (local.set $dir (i32.const 0))
    (loop $directions
      ;; Set direction vectors
      (if (i32.eq (local.get $dir) (i32.const 0))
        (then
          (local.set $dr (i32.const 0))
          (local.set $dc (i32.const 1))
        )
        (else (if (i32.eq (local.get $dir) (i32.const 1))
          (then
            (local.set $dr (i32.const 1))
            (local.set $dc (i32.const 0))
          )
          (else (if (i32.eq (local.get $dir) (i32.const 2))
            (then
              (local.set $dr (i32.const 1))
              (local.set $dc (i32.const 1))
            )
            (else
              (local.set $dr (i32.const 1))
              (local.set $dc (i32.const -1))
            )
          ))
        ))
      )
      
      (local.set $count (i32.const 1))
      
      ;; Check forward direction
      (local.set $r (i32.add (local.get $row) (local.get $dr)))
      (local.set $c (i32.add (local.get $col) (local.get $dc)))
      (loop $forward
        (if (i32.and
              (i32.and
                (i32.ge_s (local.get $r) (i32.const 0))
                (i32.lt_s (local.get $r) (global.get $ROWS))
              )
              (i32.and
                (i32.ge_s (local.get $c) (i32.const 0))
                (i32.lt_s (local.get $c) (global.get $COLS))
              )
            )
          (then
            (if (i32.eq
                  (call $getCell (local.get $board) (local.get $r) (local.get $c))
                  (local.get $player)
                )
              (then
                (local.set $count (i32.add (local.get $count) (i32.const 1)))
                (local.set $r (i32.add (local.get $r) (local.get $dr)))
                (local.set $c (i32.add (local.get $c) (local.get $dc)))
                (br $forward)
              )
            )
          )
        )
      )
      
      ;; Check backward direction
      (local.set $r (i32.sub (local.get $row) (local.get $dr)))
      (local.set $c (i32.sub (local.get $col) (local.get $dc)))
      (loop $backward
        (if (i32.and
              (i32.and
                (i32.ge_s (local.get $r) (i32.const 0))
                (i32.lt_s (local.get $r) (global.get $ROWS))
              )
              (i32.and
                (i32.ge_s (local.get $c) (i32.const 0))
                (i32.lt_s (local.get $c) (global.get $COLS))
              )
            )
          (then
            (if (i32.eq
                  (call $getCell (local.get $board) (local.get $r) (local.get $c))
                  (local.get $player)
                )
              (then
                (local.set $count (i32.add (local.get $count) (i32.const 1)))
                (local.set $r (i32.sub (local.get $r) (local.get $dr)))
                (local.set $c (i32.sub (local.get $c) (local.get $dc)))
                (br $backward)
              )
            )
          )
        )
      )
      
      ;; Check if we have a winner
      (if (i32.ge_s (local.get $count) (global.get $WIN_LENGTH))
        (return (local.get $player))
      )
      
      (local.set $dir (i32.add (local.get $dir) (i32.const 1)))
      (br_if $directions (i32.lt_s (local.get $dir) (i32.const 4)))
    )
    
    (i32.const 0)
  )
  
  ;; Check if board is full
  (func $isBoardFull (param $board i32) (result i32)
    (local $col i32)
    (local.set $col (i32.const 0))
    
    (loop $check
      (if (call $isValidMove (local.get $board) (local.get $col))
        (return (i32.const 0))
      )
      (local.set $col (i32.add (local.get $col) (i32.const 1)))
      (br_if $check (i32.lt_s (local.get $col) (global.get $COLS)))
    )
    
    (i32.const 1)
  )
  
  ;; Evaluate board position
  (func $evaluateBoard (param $board i32) (result i32)
    (local $score i32)
    (local $row i32)
    (local $col i32)
    (local $window_score i32)
    
    (local.set $score (i32.const 0))
    
    ;; Center column preference
    (local.set $row (i32.const 0))
    (loop $center_eval
      (if (i32.eq
            (call $getCell (local.get $board) (local.get $row) (i32.const 3))
            (global.get $RED)
          )
        (local.set $score (i32.add (local.get $score) (i32.const 3)))
      )
      (if (i32.eq
            (call $getCell (local.get $board) (local.get $row) (i32.const 3))
            (global.get $YELLOW)
          )
        (local.set $score (i32.sub (local.get $score) (i32.const 3)))
      )
      (local.set $row (i32.add (local.get $row) (i32.const 1)))
      (br_if $center_eval (i32.lt_s (local.get $row) (global.get $ROWS)))
    )
    
    ;; Evaluate all windows
    (local.set $row (i32.const 0))
    (loop $rows
      (local.set $col (i32.const 0))
      (loop $cols
        ;; Horizontal windows
        (if (i32.le_s (local.get $col) (i32.const 3))
          (then
            (local.set $window_score
              (call $evaluateWindow
                (local.get $board)
                (local.get $row)
                (local.get $col)
                (i32.const 0)
                (i32.const 1)
              )
            )
            (local.set $score (i32.add (local.get $score) (local.get $window_score)))
          )
        )
        
        ;; Vertical windows
        (if (i32.le_s (local.get $row) (i32.const 2))
          (then
            (local.set $window_score
              (call $evaluateWindow
                (local.get $board)
                (local.get $row)
                (local.get $col)
                (i32.const 1)
                (i32.const 0)
              )
            )
            (local.set $score (i32.add (local.get $score) (local.get $window_score)))
          )
        )
        
        ;; Diagonal windows
        (if (i32.and
              (i32.le_s (local.get $row) (i32.const 2))
              (i32.le_s (local.get $col) (i32.const 3))
            )
          (then
            (local.set $window_score
              (call $evaluateWindow
                (local.get $board)
                (local.get $row)
                (local.get $col)
                (i32.const 1)
                (i32.const 1)
              )
            )
            (local.set $score (i32.add (local.get $score) (local.get $window_score)))
          )
        )
        
        (if (i32.and
              (i32.ge_s (local.get $row) (i32.const 3))
              (i32.le_s (local.get $col) (i32.const 3))
            )
          (then
            (local.set $window_score
              (call $evaluateWindow
                (local.get $board)
                (local.get $row)
                (local.get $col)
                (i32.const -1)
                (i32.const 1)
              )
            )
            (local.set $score (i32.add (local.get $score) (local.get $window_score)))
          )
        )
        
        (local.set $col (i32.add (local.get $col) (i32.const 1)))
        (br_if $cols (i32.lt_s (local.get $col) (global.get $COLS)))
      )
      (local.set $row (i32.add (local.get $row) (i32.const 1)))
      (br_if $rows (i32.lt_s (local.get $row) (global.get $ROWS)))
    )
    
    (local.get $score)
  )
  
  ;; Evaluate a 4-cell window
  (func $evaluateWindow
    (param $board i32)
    (param $row i32)
    (param $col i32)
    (param $dr i32)
    (param $dc i32)
    (result i32)
    
    (local $red_count i32)
    (local $yellow_count i32)
    (local $i i32)
    (local $r i32)
    (local $c i32)
    (local $cell i32)
    
    (local.set $red_count (i32.const 0))
    (local.set $yellow_count (i32.const 0))
    
    ;; Count pieces in window
    (local.set $i (i32.const 0))
    (loop $count
      (local.set $r (i32.add (local.get $row) (i32.mul (local.get $i) (local.get $dr))))
      (local.set $c (i32.add (local.get $col) (i32.mul (local.get $i) (local.get $dc))))
      (local.set $cell (call $getCell (local.get $board) (local.get $r) (local.get $c)))
      
      (if (i32.eq (local.get $cell) (global.get $RED))
        (local.set $red_count (i32.add (local.get $red_count) (i32.const 1)))
      )
      (if (i32.eq (local.get $cell) (global.get $YELLOW))
        (local.set $yellow_count (i32.add (local.get $yellow_count) (i32.const 1)))
      )
      
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $count (i32.lt_s (local.get $i) (i32.const 4)))
    )
    
    ;; Score the window
    (if (i32.and
          (i32.gt_s (local.get $red_count) (i32.const 0))
          (i32.gt_s (local.get $yellow_count) (i32.const 0))
        )
      (return (i32.const 0)) ;; Mixed window
    )
    
    (if (i32.gt_s (local.get $red_count) (i32.const 0))
      (then
        (if (i32.eq (local.get $red_count) (i32.const 4))
          (return (i32.const 100))
        )
        (if (i32.eq (local.get $red_count) (i32.const 3))
          (return (i32.const 10))
        )
        (if (i32.eq (local.get $red_count) (i32.const 2))
          (return (i32.const 1))
        )
      )
    )
    
    (if (i32.gt_s (local.get $yellow_count) (i32.const 0))
      (then
        (if (i32.eq (local.get $yellow_count) (i32.const 4))
          (return (i32.const -100))
        )
        (if (i32.eq (local.get $yellow_count) (i32.const 3))
          (return (i32.const -10))
        )
        (if (i32.eq (local.get $yellow_count) (i32.const 2))
          (return (i32.const -1))
        )
      )
    )
    
    (i32.const 0)
  )
  
  ;; Minimax with alpha-beta pruning
  (func $minimax
    (param $board i32)
    (param $depth i32)
    (param $alpha i32)
    (param $beta i32)
    (param $maximizing i32)
    (result i32)
    
    (local $col i32)
    (local $row i32)
    (local $score i32)
    (local $best_score i32)
    (local $winner i32)
    
    ;; Increment nodes counter
    (global.set $nodes_searched
      (i32.add (global.get $nodes_searched) (i32.const 1))
    )
    
    ;; Check terminal states
    (local.set $winner (call $checkWinner (local.get $board)))
    (if (i32.eq (local.get $winner) (global.get $RED))
      (return (i32.sub (i32.const 10000) (local.get $depth)))
    )
    (if (i32.eq (local.get $winner) (global.get $YELLOW))
      (return (i32.add (i32.const -10000) (local.get $depth)))
    )
    (if (call $isBoardFull (local.get $board))
      (return (i32.const 0))
    )
    (if (i32.eq (local.get $depth) (i32.const 0))
      (return (call $evaluateBoard (local.get $board)))
    )
    
    ;; Initialize best score
    (if (local.get $maximizing)
      (local.set $best_score (i32.const -2147483648)) ;; MIN_INT
      (local.set $best_score (i32.const 2147483647))  ;; MAX_INT
    )
    
    ;; Try all moves
    (local.set $col (i32.const 0))
    (loop $moves
      (if (call $isValidMove (local.get $board) (local.get $col))
        (then
          ;; Make move
          (local.set $row
            (call $makeMove
              (local.get $board)
              (local.get $col)
              (if (result i32) (local.get $maximizing)
                (global.get $RED)
                (global.get $YELLOW)
              )
            )
          )
          
          ;; Recursive call
          (local.set $score
            (call $minimax
              (local.get $board)
              (i32.sub (local.get $depth) (i32.const 1))
              (local.get $alpha)
              (local.get $beta)
              (i32.xor (local.get $maximizing) (i32.const 1))
            )
          )
          
          ;; Undo move
          (call $undoMove (local.get $board) (local.get $row) (local.get $col))
          
          ;; Update best score and alpha/beta
          (if (local.get $maximizing)
            (then
              (if (i32.gt_s (local.get $score) (local.get $best_score))
                (local.set $best_score (local.get $score))
              )
              (if (i32.gt_s (local.get $best_score) (local.get $alpha))
                (local.set $alpha (local.get $best_score))
              )
            )
            (else
              (if (i32.lt_s (local.get $score) (local.get $best_score))
                (local.set $best_score (local.get $score))
              )
              (if (i32.lt_s (local.get $best_score) (local.get $beta))
                (local.set $beta (local.get $best_score))
              )
            )
          )
          
          ;; Alpha-beta pruning
          (if (i32.le_s (local.get $beta) (local.get $alpha))
            (return (local.get $best_score))
          )
        )
      )
      
      (local.set $col (i32.add (local.get $col) (i32.const 1)))
      (br_if $moves (i32.lt_s (local.get $col) (global.get $COLS)))
    )
    
    (local.get $best_score)
  )
  
  ;; Check winner (any position)
  (func $checkWinner (param $board i32) (result i32)
    (local $row i32)
    (local $col i32)
    (local $winner i32)
    
    (local.set $row (i32.const 0))
    (loop $rows
      (local.set $col (i32.const 0))
      (loop $cols
        (local.set $winner (call $checkWinnerAt (local.get $board) (local.get $row) (local.get $col)))
        (if (i32.ne (local.get $winner) (i32.const 0))
          (return (local.get $winner))
        )
        (local.set $col (i32.add (local.get $col) (i32.const 1)))
        (br_if $cols (i32.lt_s (local.get $col) (global.get $COLS)))
      )
      (local.set $row (i32.add (local.get $row) (i32.const 1)))
      (br_if $rows (i32.lt_s (local.get $row) (global.get $ROWS)))
    )
    
    (i32.const 0)
  )
  
  ;; Main function: compute best move
  ;; Returns: (move << 0) | (score << 8) packed in 32 bits
  (func $computeBestMove (export "computeBestMove")
    (param $board i32)
    (param $player i32)
    (param $depth i32)
    (result i32)
    
    (local $col i32)
    (local $row i32)
    (local $score i32)
    (local $best_score i32)
    (local $best_move i32)
    (local $maximizing i32)
    
    ;; Reset nodes counter
    (call $resetNodesSearched)
    
    ;; Determine if maximizing
    (local.set $maximizing (i32.eq (local.get $player) (global.get $RED)))
    
    ;; Initialize best values
    (local.set $best_move (i32.const -1))
    (if (local.get $maximizing)
      (local.set $best_score (i32.const -2147483648))
      (local.set $best_score (i32.const 2147483647))
    )
    
    ;; Move ordering: try center columns first
    (local $move_order i32)
    (local $actual_col i32)
    (local.set $move_order (i32.const 0))
    
    (loop $moves
      ;; Map move order to actual column (center-first)
      (if (i32.eq (local.get $move_order) (i32.const 0))
        (local.set $actual_col (i32.const 3))
        (else (if (i32.eq (local.get $move_order) (i32.const 1))
          (local.set $actual_col (i32.const 2))
          (else (if (i32.eq (local.get $move_order) (i32.const 2))
            (local.set $actual_col (i32.const 4))
            (else (if (i32.eq (local.get $move_order) (i32.const 3))
              (local.set $actual_col (i32.const 1))
              (else (if (i32.eq (local.get $move_order) (i32.const 4))
                (local.set $actual_col (i32.const 5))
                (else (if (i32.eq (local.get $move_order) (i32.const 5))
                  (local.set $actual_col (i32.const 0))
                  (else
                    (local.set $actual_col (i32.const 6))
                  )
                ))
              ))
            ))
          ))
        ))
      )
      
      (if (call $isValidMove (local.get $board) (local.get $actual_col))
        (then
          ;; Make move
          (local.set $row
            (call $makeMove
              (local.get $board)
              (local.get $actual_col)
              (local.get $player)
            )
          )
          
          ;; Check for immediate win
          (if (i32.eq
                (call $checkWinnerAt (local.get $board) (local.get $row) (local.get $actual_col))
                (local.get $player)
              )
            (then
              ;; Found winning move
              (call $undoMove (local.get $board) (local.get $row) (local.get $actual_col))
              (return
                (i32.or
                  (local.get $actual_col)
                  (i32.shl (i32.const 10000) (i32.const 8))
                )
              )
            )
          )
          
          ;; Evaluate position
          (local.set $score
            (call $minimax
              (local.get $board)
              (i32.sub (local.get $depth) (i32.const 1))
              (i32.const -2147483648)
              (i32.const 2147483647)
              (i32.xor (local.get $maximizing) (i32.const 1))
            )
          )
          
          ;; Undo move
          (call $undoMove (local.get $board) (local.get $row) (local.get $actual_col))
          
          ;; Update best move
          (if (local.get $maximizing)
            (then
              (if (i32.gt_s (local.get $score) (local.get $best_score))
                (then
                  (local.set $best_score (local.get $score))
                  (local.set $best_move (local.get $actual_col))
                )
              )
            )
            (else
              (if (i32.lt_s (local.get $score) (local.get $best_score))
                (then
                  (local.set $best_score (local.get $score))
                  (local.set $best_move (local.get $actual_col))
                )
              )
            )
          )
        )
      )
      
      (local.set $move_order (i32.add (local.get $move_order) (i32.const 1)))
      (br_if $moves (i32.lt_s (local.get $move_order) (i32.const 7)))
    )
    
    ;; Pack result: move | (score << 8)
    ;; Normalize score to fit in 16 bits
    (local.set $best_score
      (i32.add
        (i32.div_s (local.get $best_score) (i32.const 10))
        (i32.const 10000)
      )
    )
    
    (i32.or
      (local.get $best_move)
      (i32.shl (local.get $best_score) (i32.const 8))
    )
  )
  
  ;; Fast evaluation for shallow searches
  (func $quickEvaluate (export "quickEvaluate")
    (param $board i32)
    (param $player i32)
    (result i32)
    
    (local $winner i32)
    
    ;; Check for immediate wins/losses
    (local.set $winner (call $checkWinner (local.get $board)))
    (if (i32.eq (local.get $winner) (local.get $player))
      (return (i32.const 10000))
    )
    (if (i32.and
          (i32.ne (local.get $winner) (i32.const 0))
          (i32.ne (local.get $winner) (local.get $player))
        )
      (return (i32.const -10000))
    )
    
    ;; Return board evaluation
    (if (i32.eq (local.get $player) (global.get $RED))
      (return (call $evaluateBoard (local.get $board)))
      (return (i32.mul (call $evaluateBoard (local.get $board)) (i32.const -1)))
    )
  )
  
  ;; Hash board position for transposition table
  (func $hashBoard (export "hashBoard") (param $board i32) (result i32)
    (local $hash i32)
    (local $i i32)
    (local $cell i32)
    
    (local.set $hash (i32.const 0))
    (local.set $i (i32.const 0))
    
    (loop $cells
      (local.set $cell (i32.load (i32.add (local.get $board) (i32.mul (local.get $i) (i32.const 4)))))
      (local.set $hash
        (i32.xor
          (local.get $hash)
          (i32.rotl
            (i32.add (local.get $cell) (i32.const 1))
            (i32.rem_u (local.get $i) (i32.const 32))
          )
        )
      )
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $cells (i32.lt_s (local.get $i) (i32.const 42)))
    )
    
    (local.get $hash)
  )
)