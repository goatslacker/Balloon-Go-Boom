var BalloonGoBoom = (function () {

  var id = "",
      square = 8,
      size = 40,
      grid = [],
      bgrid = [],
      undo_grid = [],
      balloons = ['blue', 'yellow', 'purple', 'red'],
      balloons_dead = ['boom'],
      found = [],
      score = 0,
      undo_score = 0,
      gravityQueue = [],

      /* functions */
      FX = null,
      Tools = null,
      newGame = null,
      blit = null,
      draw = null,
      find = null,
      finder = null,
      bindFind = null,
      boom = null,
      disappear = null,
      gravity = null,
      gravitate = null,
      rebuildGrid = null,
      isGameOver = null,
      isClumped = null,
      isPlayable = null,
      isSolvable = null,
      gameOver = null;

  Tools = (function () {
    return {
      /**
        @private
        Custom in_array, checks to see if the X and Y coordinates are already in the array.
        */
      object_in_array: function (arr, obj) {

        // loop through each element in the array
        for (var i = 0; i < arr.length; i = i + 1) {

          // if it's already in the array, return true
          if (arr[i].x === obj.x && arr[i].y === obj.y) {
            return true;
          }
        }
        return false;
      },

      /**
        @private
        Checks to see if a value is already in an array
        */
      in_array: function (arr, val) {
        for (var i = 0; i < arr.length; i = i + 1) {
          if (arr[i] === val) {
            return true;
          }
        }
        return false;
      }
    };
  }());

  /**
    @private
    */
  FX = (function () {

    var timer = false,
        elementQueue = [],
        emile = {};

    emile = {
      properties: ['backgroundColor', 'borderBottomColor', 'borderBottomWidth', 'borderLeftColor', 'borderLeftWidth',
        'borderRightColor', 'borderRightWidth', 'borderSpacing', 'borderTopColor', 'borderTopWidth', 'bottom', 'color', 'fontSize',
        'fontWeight', 'height', 'left', 'letterSpacing', 'lineHeight', 'marginBottom', 'marginLeft', 'marginRight', 'marginTop', 'maxHeight',
        'maxWidth', 'minHeight', 'minWidth', 'opacity', 'outlineColor', 'outlineOffset', 'outlineWidth', 'paddingBottom', 'paddingLeft',
        'paddingRight', 'paddingTop', 'right', 'textIndent', 'top', 'width', 'wordSpacing', 'zIndex'],
      parseEl: false,

      interpolate: function (source, target, pos) { 
        return (source + (target - source) * pos).toFixed(3);
      },

      parse: function (property) {
        var p = parseFloat(property), q = property.replace(/^[\-\d\.]+/, '');
        return { value: p, func: this.interpolate, suffix: q };
      },

      normalize: function (style) {
        var css, rules = {}, i = this.properties.length;

        this.parseEl.innerHTML = '<div style="' + style + '"></div>';
        css = this.parseEl.childNodes[0].style;

        while (i >= 0) {
          if (css[this.properties[i]]) {
            rules[this.properties[i]] = this.parse(css[this.properties[i]]);
          }
          i = i - 1;
        }

        return rules;
      }
    };

    function run() {
      var time = (new Date()).getTime(), pos, property, i, j = 0, obj;
      for (i = 0; i < elementQueue.length; i = i + 1) {
        obj = elementQueue[i];

        if (!obj) {
          obj = null;
        }

        if (obj === null) {
          j = j + 1;
          if (j === elementQueue.length) {
            FX.stop();
          }

          continue;
        }

        pos = (time > obj.end) ? 1 : (time - obj.start) / obj.opts.duration;

        for (property in obj.target) {
          if (obj.target.hasOwnProperty(property)) {
            obj.element.style[property] = obj.target[property].func(obj.current[property].value, obj.target[property].value, obj.opts.easing(pos)) + obj.target[property].suffix;
          }
        }
        
        if (time > obj.end) {
          if (obj.callback) {
            obj.callback();
          }
          elementQueue[i] = null;
        }
      }
    }

    function FX(element, style, opts, callback) {
      opts = opts || {};
      opts.duration = opts.duration || 500;
      opts.easing = opts.easing || function (pos) { 
        return (-Math.cos(pos * Math.PI) / 2) + 0.5; 
      };

      if (!emile.parseEl) {
        emile.parseEl = document.createElement('div');
      }

      var target = emile.normalize(style), 
      comp = element.currentStyle ? element.currentStyle : getComputedStyle(element, null),
      property, 
      current = {}, 
      start = (new Date()).getTime(), 
      end = start + opts.duration,
      id = elementQueue.length;

      for (property in target) {
        if (target.hasOwnProperty(property)) {
          current[property] = emile.parse(comp[property]);
        }
      }

      elementQueue.push({
        id: id,
        element: element,
        opts: opts,
        start: start,
        end: end,
        target: target,
        current: current,
        callback: callback
      });

      if (!timer) {
        timer = setInterval(run, 10);
      }

      return id;
    }

    FX.stop = function (id) {
      id = id || false;

      if (typeof(id) === "number") {
        elementQueue[id] = null;
      } else if (typeof(id) === "object") {
        for (var i = 0; i < id.length; i = i + 1) {
          elementQueue[id[i]] = null;
        }
      } else {
        clearInterval(timer);
        timer = false;
        elementQueue = [];
      }
    };

    return FX;

  }());

  /**
    @private
    Creates a single image
    */
  blit = function (x, y) {
    // loading image
    var img = new Image();
    img.src = 'images/' + grid[x][y] + '.png';

    // positioning
    img.style.position = 'absolute';
    img.style.left = x * size + 'px';
    img.style.bottom = y * size + 'px';

    // attaching events
    img.onclick = bindFind(x, y);

    // blitting
    document.getElementById(id).appendChild(img);

    return img;
  };

  /**
    @private
    Repositions elements on the screen
    */
  draw = function () {
    var y = 0, x = 0, img = false, coor = [];

    for (x = 0; x < grid.length; x = x + 1) {
      for (y = 0; y < grid[x].length; y = y + 1) {

        // if element does not exist - set it for gravity
        if (grid[x][y] === undefined) {

          // organize the array
          if (coor[x] === undefined) {
            coor[x] = [];
          }
          coor[x].push(y);
          coor[x].sort();

          continue;
        }
    
        // alter positions of elements
        img = bgrid[x][y];
        img.style.left = x * size + 'px';
        img.style.bottom = y * size + 'px';
      }
    }

    // apply gravity to the board
    gravity(coor);
  };

  /**
    @private
    Finds all neighboring elements. Top/Bottom/Right/Left
    */
  finder = function (x, y) {
    var results = [], obj = { };

    // if the multi-dimensional array exists
    if (grid[x + 1] !== undefined) {

      // if we have a similarity
      if (grid[x][y] === grid[x + 1][y]) {
        obj = { x: x + 1, y: y };
  
        // if it's not already in the found list
        if (!Tools.object_in_array(found, obj)) {

          // add to the found list
          results.push(obj);
        }
      }
    }

    if (grid[x - 1] !== undefined) {
      if (grid[x][y] === grid[x - 1][y]) {
        obj = { x: x - 1, y: y };
  
        if (!Tools.object_in_array(found, obj)) {
          results.push(obj);
        }
      }
    }

    if (grid[x][y + 1] !== undefined) {
      if (grid[x][y] === grid[x][y + 1]) {
        obj = { x: x, y: y + 1 };
  
        if (!Tools.object_in_array(found, obj)) {
          results.push(obj);
        }
      }
    }

    if (grid[x][y - 1] !== undefined) {
      if (grid[x][y] === grid[x][y - 1]) {
        obj = { x: x, y: y - 1 };
  
        if (!Tools.object_in_array(found, obj)) {
          results.push(obj);
        }
      }
    }

    // return the found list
    return results;
  };

  /**
    @private
    Recursively finds any neighboring elements
    */
  find = function (x, y) {
    var i = 0, img = false;

    // intial find, top/bottom/right/left
    found = finder(x, y);

    // recursively loop, while we keep finding elements, keep checking each for more neighboring elements
    while (i < found.length) {
      // array merge the new results found, if any
      found = found.concat(finder(found[i].x, found[i].y));
      i = i + 1;
    }

    if (found.length > 0) {
      // Balloons go Boom!
      boom();
    }
  };

  /**
    @private
    */
  bindFind = function (x, y) {
    return function () {
      find(x, y);
    };
  };

 /**
  @private
  Sets elements to be removed from board
  */
  boom = function () {
    var img = false, i = 0, x = 0, y = 0, tmpgrid = [];

    // Setting undo grid
    for (x = 0; x < square; x = x + 1) {
      tmpgrid[x] = [];
      for (y = 0; y < grid[x].length; y = y + 1) {
        tmpgrid[x][y] = grid[x][y];
      }
    }
    undo_grid = tmpgrid;

    // loop through each item found
    for (i = 0; i < found.length; i = i + 1) {

      // set the item to the boom image
      img = bgrid[found[i].x][found[i].y];
      img.src = 'images/' + balloons_dead[0] + '.png';
    }

    // remove from board
    setTimeout(function () {
      disappear();
    }, 80);
  };

  /**
    @private
    Makes all elements disappear
    */
  disappear = function () {
    var i = 0, 
        div = document.getElementById(id), 
        img = false;

    // loop through each element found previously
    for (i = 0; i < found.length; i = i + 1) {
      img = bgrid[found[i].x][found[i].y];

      // set the pointers to undefined since the objects don't exist anymore
      bgrid[found[i].x][found[i].y] = undefined;
      grid[found[i].x][found[i].y] = undefined;

      // remove the object from the board
      div.removeChild(img);
    }

    undo_score = score;
  
    // add the score
    score = score + (Math.pow(found.length, 2) * 4);

    // delete all found elements
    found = [];

    // apply gravity to the board
    gravity();
  };

  /**
    @private
    Applies gravity to the board by finding all elements that need to be dropped and dropping them
    */
  gravity = function () {
    var x = 0, y = 0, pull = 0;

    // loop through each column
    for (x = 0; x < grid.length; x = x + 1) {

      // reset the pull
      pull = 0;

      // loop through each item
      for (y = 0; y < grid[x].length; y = y + 1) {

        // if the item is null, add to the pull
        if (grid[x][y] === undefined) {
          pull = pull + 1;

        // if the pull is bigger than 0
        } else if (pull > 0) {

          // set the item to fall down
          gravitate({ x: x, y: y }, pull);
        }
      }
    }

    // Once gravity is done, rebuild the pointers
    rebuildGrid();
  };

  /**
    @private
    Applies gravity to an item
    */
  gravitate = function (obj, pull) {
    var img = bgrid[obj.x][obj.y];

    // TODO - test the gravity queue
    gravityQueue.push(FX(img, "bottom: " + ((obj.y - pull) * size) + "px", {
      duration: 1000,
      easing: function (pos) {
        if (pos < (1 / 2.75)) {
          return (7.5625 * pos * pos);
        } else if (pos < (2 / 2.75)) {
          return (7.5625 * (pos -= (1.5 / 2.75)) * pos + 0.75);
        } else if (pos < (2.5 / 2.75)) {
          return (7.5625 * (pos -= (2.25 / 2.75)) * pos + 0.9375);
        } else {
          return (7.5625 * (pos -= (2.625 / 2.75)) * pos + 0.984375);
        }
      }
    }));
  };

  /**
    @private
    Rebuilds the pointers for the grid matrix and the balloon img matrix
    */
  rebuildGrid = function () {
    var tmpGrid = [], tmpBGrid = [], img = false, yp = 0, x = 0, y = 0, columns = 0, items = [];

    for (x = 0; x < square; x = x + 1) {

      if (grid[x] === undefined) {
        tmpGrid[x] = [];
      }

      if (tmpBGrid[x] === undefined) {
        tmpBGrid[x] = [];
      }

      // creates new multi-dim array if not found
      if (tmpGrid[x] === undefined) {
        tmpGrid[x] = [];
      }

      for (y = 0; y < square; y = y + 1) {

        // if the item is null, skip this record
        if (grid[x][y] === undefined) {
          continue;
        }

        // adds the previous record to the new structure
        tmpGrid[x].push(grid[x][y]);

        // adds the balloon image object to the pointer
        tmpBGrid[x].push(bgrid[x][y]);

        yp = tmpBGrid[x].length - 1;

        // positioning
        img = tmpBGrid[x][yp];

        // reattach events
        img.onclick = bindFind(x, yp);

        // add each item to an array
        items.push(tmpGrid[x][y]);
      }

      if (tmpGrid[x].length > 0) {
        columns = columns + 1;
      }
    }

    // resets the record sets
    grid = tmpGrid;
    bgrid = tmpBGrid;

    // check for game over
    isGameOver(items, columns);
  };

  /**
    @private
    Condition to check if game is over
    */
  isGameOver = function (items, columns) {

    // if the game is not playable
    if (!isPlayable()) {

      // all items cleared
      if (items.length === 0) {
        return gameOver(true);

      // 1 column
      } else if (columns === 1) {
        return gameOver(false);

      // 1 row
      } else if (columns === items.length) {
        // and it's clumped
        if (isClumped()) {
          return gameOver(false);
        }

      // less than balloons.length remains
      } else if (items.length <= balloons.length) {
        var i = 0, tmp = [];

        // loop through each item
        for (i = 0; i < items.length; i = i + 1) {

          // push different pieces into a temporary array
          if (!Tools.in_array(tmp, items[i])) {
            tmp.push(items[i]);
          }
        }

        // if temporary array is the same as original then all pieces are different
        if (tmp.length === items.length) {
          return gameOver(false);
        }

      // the grid is unsolvable
      } else if (isClumped() && !isSolvable()) {
        return gameOver(false);
      }
    }

    return false;
  };

  /**
    @private
    Tests to see if the entire group is clumped or if it's out of order.
    Important! to test if the grid is solvable or not
    Future todo: Determine corners and adjacent without the need for clumping
    */
  isClumped = function () {
    var x = 0, xr = [];
    
    // loop through each column
    for (x = 0; x < grid.length; x = x + 1) {

      // pushes a supposed sequential number into an array if the column has items available
      if (grid[x].length > 0) {
        xr.push(x);
      }
    }

    // loop through the sequential array
    for (x = 0; x < (xr.length - 1); x = x + 1) {

      // if the next number is out of sequence, the group is not clumped
      if (xr[x] + 1 !== xr[x + 1]) {
        return false;
      }
    }

    return true;
  };

  /**
    @private
    Returns the first and last columns that are filled in the grid
    @return {Array} X position, 0 - first column, 1 - last column
    */
  function getFirstLastColumns() {
    var x = 0, columns = [], last = 0;

    for (x = 0; x < square; x = x + 1) {

      // if this column has items
      if (grid[x].length > 0) {

        // increment the last column counter
        last = x;

        // if there is nothing in the array, set the first column
        if (columns.length === 0) {
          columns.push(x);
        }
      }
    }
    // push the last column
    columns.push(last);

    return columns;
  }

  /**
    @private
    Tests if there are any moves available
    @return {boolean}
    */
  isPlayable = function () {
    var y = 0, x = 0;

    for (x = 0; x < grid.length; x = x + 1) {
      for (y = 0; y < grid[x].length; y = y + 1) {

        // vertical check
        if (grid[x][y] === grid[x][y + 1]) {
          return true;
        }

        // horizontal check
        if (grid[x + 1] !== undefined) {
          if (grid[x][y] === grid[x + 1][y]) {
            return true;
          }
        }

      }
    }

    return false;
  };

  /**
    @private
    */
  isSolvable = function () {
    var i = 0, x = 0, y = 0, corners = [], adjacent = [], fnl = getFirstLastColumns(), box = 0, cornersXY = [], tmpAdj = false;

    // loop through grid
    for (x = 0; x < square; x = x + 1) {

      // TODO - test (this is prevrow) AKA the "box"

      // we are above first column
      // we are below last column
      // next column has items
      // previous column has items
      // current column has fewer items than previous column
      // current column has more items than next column
      // we reset the box to match the current X column count
      if (
          x > fnl[0] && 
          x < fnl[1] &&
          grid[x + 1].length > 0 &&
          grid[x - 1].length > 0 &&
          grid[x].length < grid[x - 1].length &&
          grid[x].length > grid[x + 1].length
      ) {
        box = x;
      } else {
        box = box;
      }

      // first column has corners
      // last column has corners
      // if there is a next column and current column is unequal to next column, current column has corners
      if (
        x === fnl[0] || 
        x === fnl[1] || 
        (grid[x + 1] !== undefined && grid[x].length !== grid[x + 1].length)
      ) {

        // push first item
        if (!Tools.in_array(corners, grid[x][0])) {
          corners.push(grid[x][0]);
        }

        // push last item
        if (!Tools.in_array(corners, grid[x][grid[x].length - 1])) {
          corners.push(grid[x][grid[x].length - 1]);
        }

        // push coordinates so we can find the adjacent pieces later
        if (!Tools.object_in_array(cornersXY, { x: x, y: 0 })) {
          cornersXY.push({ x: x, y: 0});
        }
        if (!Tools.object_in_array(cornersXY, { x: x, y: grid[x].length - 1 })) {
          cornersXY.push({ x: x, y: grid[x].length - 1});
        }

        // complete the "box" TODO (still unsure about this whole box thing)
        if (x > fnl[0] && grid[x].length <= grid[x - 1].length) {

          if (!Tools.in_array(corners, grid[box][0])) {
            corners.push(grid[box][0]);
          }

          if (!Tools.in_array(corners, grid[box][grid[box].length - 1])) { // todo - test
            corners.push(grid[box][grid[box].length - 1]);
          }

        }

      }
      
    }

    // loop through the corner's coordinates Array to find adjacent pieces
    for (i = 0; i < cornersXY.length; i = i + 1) {
      x = cornersXY[i].x;
      y = cornersXY[i].y;

      // up
      if (grid[x][y + 1] !== undefined) {
        if (!Tools.in_array(adjacent, grid[x][y + 1])) {
          adjacent.push(grid[x][y + 1]);
        }
      }

      // right
      if (grid[x + 1] !== undefined) {
        if (grid[x + 1][y] !== undefined) {
          if (!Tools.in_array(adjacent, grid[x + 1][y])) {
            adjacent.push(grid[x + 1][y]);
          }
        }
      }

      // down
      if (grid[x][y - 1] !== undefined) {
        if (!Tools.in_array(adjacent, grid[x][y - 1])) {
          adjacent.push(grid[x][y - 1]);
        }
      }

      // left
      if (grid[x - 1] !== undefined) {
        if (grid[x - 1][y] !== undefined) {
          if (!Tools.in_array(adjacent, grid[x - 1][y])) {
            adjacent.push(grid[x - 1][y]);
          }
        }
      }

    }

    // loop through adjacent to find a match
    for (i = 0; i < adjacent.length; i = i + 1) {

      // if there is a match, the grid is solvable
      if (Tools.in_array(corners, adjacent[i])) {
        return true;
      }
    }

    // the grid is unsolvable
    return false;
  };

  /**
    @private
    End of Game
    */
  gameOver = function (winner) {

    // if you win, add 200 to score
    if (winner === true) {
      score = score + 200;
    }

    // return if a callback is set
    if (!1 === true) {
//      this.callbacks.gameover(score);
    } else {

      // confirm new game
      if (confirm("Game Over. New Game?") === true) {
        newGame();
      }
    }
  };

  /**
    @private
    Starts a new game
    */
  newGame = function () {
    var y = 0, x = 0, b = 0, img = false;

    for (x = 0; x < square; x = x + 1) {
      for (y = 0; y < square; y = y + 1) {

        // randomly select a balloon
        b = Math.floor(Math.random() * balloons.length, 1);

        // setting the grid
        if (grid[x] === undefined) {
          grid[x] = [];
          bgrid[x] = [];
        }

        grid[x][y] = balloons[b];

        // create the balloons
        img = blit(x, y);

        bgrid[x][y] = img;

      }
    }
  };

  function BalloonGoBoom(pid, callbacks) {
    id = pid;
    this.reset();
    this.init();
  }

  BalloonGoBoom.prototype = {
  /*
    Resets all the elements on the board
  */
    reset: function () {
      document.getElementById(id).innerHTML = '';
      score = 0;
      found = [];
      grid = [];
      bgrid = [];
      undo_grid = [];
    },

  /*
    Resumes a game
    @param {Array} grid - the grid dataset
    @param {integer} score - previous game's score
  */
    resume: function (grid, score) {
      this.reset();
      score = score;
      grid = grid;

      var y = 0, x = 0, img = false;

      for (x = 0; x < grid.length; x = x + 1) {
        for (y = 0; y < grid[x].length; y = y + 1) {

          // setting the bgrid
          if (bgrid[x] === undefined) {
            bgrid[x] = [];
          }

          // create the balloons
          img = blit(x, y);

          bgrid[x][y] = img;

        }
      }
    },

  /* 
    Initializes the board, sets the data set and draws the board
  */
    init: function (callback) {
      newGame();
    },

  /*
    Rotates the board in a given direction
    @param {integer} direction - 1 = clockwise, 2 = counter-clockwise, 3 = invert
  */
    rotate: function (direction) {
      var tmpGrid = [], tmpBGrid = [], y = 0, x = 0, yp = 0, xp = 0;

      // stops the gravity from running (TODO - test, and add to other methods that may need to stop the gravity from running)
      if (gravityQueue.length > 0) {
        for (x = 0; x < gravityQueue.length; x = x + 1) {
          FX.stop(gravityQueue[x]);
        }
        gravityQueue = [];
      }
      
      for (x = 0; x < square; x = x + 1) {

        for (y = 0; y < square; y = y + 1) {
          yp = (square - 1) - y;

          switch (direction) {

          // clockwise
          case 1:
            if (tmpGrid[x] === undefined) {
              tmpGrid[x] = [];
            }
            if (tmpBGrid[x] === undefined) {
              tmpBGrid[x] = [];
            }
            tmpGrid[x][y] = grid[yp][x];
            tmpBGrid[x][y] = bgrid[yp][x];
            break;

          // counter-clockwise
          case 2:
            if (tmpGrid[yp] === undefined) {
              tmpGrid[yp] = [];
            }
            if (tmpBGrid[yp] === undefined) {
              tmpBGrid[yp] = [];
            }
            tmpGrid[yp][x] = grid[x][y];
            tmpBGrid[yp][x] = bgrid[x][y];
            break;

          // inverse
          case 3:
            xp = (square - 1) - x;
            if (tmpGrid[x] === undefined) {
              tmpGrid[x] = [];
            }
            if (tmpBGrid[x] === undefined) {
              tmpBGrid[x] = [];
            }
            
            tmpGrid[x][y] = grid[xp][yp];
            tmpBGrid[x][y] = bgrid[xp][yp];
            break;

          }
        }
      }

      // reset the pointers
      grid = tmpGrid;
      bgrid = tmpBGrid;

      // reposition the elements on the screen
      draw();
    },

  /*
    Undo user's previous move
  */
    undo: function () {
      if (undo_grid.length > 0) {
        var x = 0, y = 0, img = false;

        score = undo_score;
        grid = undo_grid;
        bgrid = [];
        
        document.getElementById(this.id).innerHTML = '';
      
        // rebuild the balloon pointer
        for (x = 0; x < square; x = x + 1) {
          for (y = 0; y < grid[x].length; y = y + 1) {

            if (bgrid[x] === undefined) {
              bgrid[x] = [];
            }

            // rebuild the board
            img = blit(x, y);
            bgrid[x][y] = img;

          }
        }
      
        // reset the undo grid
        undo_grid = [];
      }
    },

    canUndo: function () {
      return (undo_grid.length !== 0);
    },

    isClumped: function () {
      return isClumped();
    },

    isGameOver: function () {
      return isGameOver();
    },

    isPlayable: function () {
      return isPlayable();
    },

    isSolvable: function () {
      return isSolvable();
    }

  };

  return BalloonGoBoom;
}());
