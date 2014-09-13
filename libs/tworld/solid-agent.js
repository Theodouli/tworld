/*
* solid-agent.js - 
*
* Copyright (C) 2014 Burdisso Sergio (sergio.burdisso@gmail.com)
*
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as
* published by the Free Software Foundation, either version 3 of the
* License, or (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Affero General Public License for more details.
*
* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <http://www.gnu.org/licenses/>
*/

importScripts('solid-auxiliary.js', 'solid-global.js', '../util/sprintf.min.js'); 

/*API
-coordenate_relativesToAgent(){ - porque como lo voy a hacer multi agente no puedo hacer que las cosas sean relativas al agente, para eso uso esta funcion
    object[0] = _agentPos.Row - object[0];
    object[1] = object[1] - _agentPos.Column;
*/

var alert = function(msg){
    if (msg instanceof Object)
        msg = JSON.stringify(msg);

    $return(_ACTION.CONSOLE_LOG + msg);
}

//console guard
try{
    console.clear();
    var _console = console;
    console = {};
 }catch(e){ var console = {} };
console.error = function(msg){ $return(_ACTION.CONSOLE_ERROR + msg)}
console.clear = function(msg){ $return(_ACTION.CONSOLE_CLEAR)}
console.log = alert;

function printf(){console.log(sprintf.apply(this, arguments))};
var perror = console.error;
var writeln = alert;

var _ACTION_SENT;
var _LAST_ERROR_SENT = "";
var _PERCEPT = null;
var _GRID;
var _AGENT;

var _WEST= _ACTION.WEST;
var _EAST= _ACTION.EAST;
var _NORTH= _ACTION.NORTH;
var _SOUTH= _ACTION.SOUTH;
var _NONE= _ACTION.NONE;
var _RESTORE= _ACTION.RESTORE;

var __AgentProgram__;
var __onMessageReceived__;
var __onStart__;
var __error__;
var __thinking__;

var $m;
var $memory;
var $persistent;

function __AgentProgram__Wrapper__(percept)/*returns action*/{
    percept = percept.data;

    switch(percept.header){
        case _PERCEPT_HEADER.INTERNAL:
            __error__ = false;
            $memory= $persistent= $m= percept.data.memory || {};

            // searching for errors

            try{ eval(percept.data.global_src); }
            catch(e){
                var matchs = e.stack.match(/(anonymous|eval)[^0-9 ]*(\d+)[^0-9]*(\d+)/i);
                if (!matchs)    console.error(e.stack);
                else            console.error(e.name + ": " + e.message + " at 'Global Scope' section (Line:"+matchs[2]+", Column:"+matchs[3]+")");
                __error__ = true;
            }
            if (__error__) return;
            try{ eval(percept.data.ai_src); }
            catch(e){
                var matchs = e.stack.match(/(anonymous|eval)[^0-9 ]*(\d+)[^0-9]*(\d+)/i);
                if (!matchs)    console.error(e.stack);
                else            console.error(e.name + ": " + e.message + " at 'Agent Program' section (Line:"+matchs[2]+", Column:"+matchs[3]+")");
                __error__ = true;
            }
            if (__error__) return;
            try{ eval(percept.data.start_src); }
            catch(e){
                var matchs = e.stack.match(/(anonymous|eval)[^0-9 ]*(\d+)[^0-9]*(\d+)/i);
                if (!matchs)    console.error(e.stack);
                else            console.error(e.name + ": " + e.message + " at 'Start Event' section (Line:"+matchs[2]+", Column:"+matchs[3]+")");
                __error__ = true;
            }
            if (__error__) return;
            try{ eval(percept.data.msg_src); }
            catch(e){
                var matchs = e.stack.match(/(anonymous|eval)[^0-9 ]*(\d+)[^0-9]*(\d+)/i);
                if (!matchs)    console.error(e.stack);
                else            console.error(e.name + ": " + e.message + " at 'Message Received Event' section (Line:"+matchs[2]+", Column:"+matchs[3]+")");
                __error__ = true;
            }
            if (__error__) return;

            eval(
                "(function(){"+
                    percept.data.global_src+

                    "(function(){"+
                        percept.data.ai_src
                            .replace(/(\$(return|perceive)\s*\([^;}]*?\)[^}]?)/g, "{$1;return}")
                        +"\
                        __AgentProgram__= AGENT_PROGRAM\
                    })();"+

                    "(function(){"+
                        percept.data.start_src
                        +"\
                        __onStart__= onStart\
                    })();"+

                    "(function(){"+
                        percept.data.msg_src
                        +"\
                        __onMessageReceived__= onMessageReceived\
                    })()\
                })()"
            );
            break;

        case _PERCEPT_HEADER.START:
                try{
                    __onStart__(percept.data);
                }catch(e){
                    var matchs = false;//e.stack.match(/(anonymous|eval)[^0-9 ]*(\d+)[^0-9]*(\d+)/i);
                    if (!matchs)    console.error(e.stack);
                    else            console.error(e.name + ": " + e.message + " at 'onStart' (Line:"+matchs[2]+", Column:"+matchs[3]+")");
                };
                $return(_ACTION.NONE);
            break;

        case _PERCEPT_HEADER.ERROR:
            if (_LAST_ERROR_SENT != percept.data){
                _LAST_ERROR_SENT = percept.data;
                console.error(percept.data.match(/^'([^]*)'$/)[1]);
            }
            break;

        case _PERCEPT_HEADER.END:
            $return(_ACTION._SAVE_MEMORY_ + JSON.stringify($memory))
            self.close();
            break;

        case _PERCEPT_HEADER.MESSAGE:
            var msg;

            try{msg = JSON.parse(percept.data)}
            catch(e){msg = percept.data}//if not a JSON then pass a sting to "__onMessageReceived__"

            try{
                __onMessageReceived__(msg);
            }catch(e){
                var matchs = e.stack.match(/(anonymous|eval)[^0-9 ]*(\d+)[^0-9]*(\d+)/i);
                if (!matchs)    console.error(e.stack);
                else            console.error(e.name + ": " + e.message + " at onMessageReceived (Line:"+matchs[2]+", Column:"+matchs[3]+")");
            };
            $perceive();
            break;

        case _PERCEPT_HEADER.PAUSE:
            if (percept.data == "off")
                $perceive();
            break;

        default: if (!__error__){
            //HIDDEN
            percept = percept.data;

            _PERCEPT = percept;
            _GRID = percept.environment.grid;
            _GRID.ROWS = _GRID.length;
            _GRID.COLUMNS = _GRID[0].length;

            _AGENT = percept.agent;
            _ACTION_SENT = false;

            if (!__thinking__){
                try{
                    __AgentProgram__(percept);
                }catch(e){
                    var matchs = e.stack.match(/(anonymous|eval)[^0-9 ]*(\d+)[^0-9]*(\d+)/i);
                    if (!matchs)    console.error(e.stack);
                    else            console.error(e.name + ": " + e.message + " at AGENT_PROGRAM (Line:"+matchs[2]+", Column:"+matchs[3]+")");
                };
            }

            //ACTIONS GUARD
            if (!_ACTION_SENT)
                $perceive();
        }
    }
}onmessage = __AgentProgram__Wrapper__; 

// transition model
function $result(state, action, paint){ if (state.agent.battery == 0) return state;
    //TODO: if multiplier
    //      if no partial reward
    //      if easy mode
    state = copy(state);

    var ir=0, ic=0, r=0, c=0;
    var loc = state.agent.location;
    var env = state.environment;
    var grid = env.grid;
    var costs = state.builtin_knowledge.costs;

    if (!$isValidMove(state, action)){
        state.agent.stats.bad_moves++;
        state.agent.battery -= costs.battery.bad_move;
        state.agent.battery = state.agent.battery >= 0? state.agent.battery : 0;
        env.time += costs.bad_move/1000;
        return state;
    }

    state.agent.stats.good_moves++;
    state.agent.battery -= costs.battery.good_move;
    state.agent.stats.battery_used+= costs.battery.good_move;
    env.time += costs.good_move/1000;

    switch(action){
        case _NORTH:    r = -1; break;
        case _SOUTH:    r =  1; break;
        case _WEST:     c = -1; break;
        case _EAST:     c =  1; break;
        case _RESTORE:
            state.agent.battery = 1000;
            state.agent.stats.battery_restore++;
            state.agent.score -= (state.agent.score/2)|0; 
            return state;
        default:
            console.error('$result: invalid action');
            return state;
    }

    if (paint)
        $paintCell(loc.row+r, loc.column+c);

    if ($isCharger(state, loc.row+r, loc.column+c)){
        state.agent.battery = 1000;
        state.agent.stats.battery_recharge++;
        state.agent.score = state.agent.score-10 >= 0? state.agent.score-10 : 0; 
    }

    for (ir= loc.row+r, ic= loc.column+c; $isTile(state, ir, ic); ir=ir+r, ic=ic+c);

    if (ir == loc.row+r && ic == loc.column+c){//if there is no tile to push
        grid[loc.row][loc.column] =  $isCharger(state, loc.row, loc.column)?
                                        _GRID_CELL.BATTERY_CHARGER : _GRID_CELL.EMPTY;
        grid[loc.row+r][loc.column+c] = _GRID_CELL.AGENT;
    }else
    if ($isHoleCell(state, ir, ic)) {
        grid[ir][ic] = _GRID_CELL.EMPTY;
        grid[loc.row][loc.column] =  $isCharger(state, loc.row, loc.column)?
                                        _GRID_CELL.BATTERY_CHARGER : _GRID_CELL.EMPTY;
        grid[loc.row+r][loc.column+c] = _GRID_CELL.AGENT;

        state.agent.stats.battery_used+= costs.battery.slide_tile;

        for (var i=env.holes.length; i--;)
            for (var j=env.holes[i].cells.length; j--;)
                if (env.holes[i].cells[j].row == ir &&
                    env.holes[i].cells[j].column == ic)
                {
                    env.holes[i].cells.remove(j);

                    state.agent.stats.battery_used+= costs.battery.slide_tile;
                    state.agent.battery -= costs.battery.slide_tile;

                    if (!env.holes[i].cells.length){ // if hole's filled
                        //TODO: if multiplier
                        state.agent.stats.filled_holes++;
                        state.agent.score += env.holes[i].value;

                        env.time += costs.filled_hole/1000;

                        env.holes.remove(i);
                        break;
                    }else
                        state.agent.score += (env.holes[i].size - env.holes[i].cells.length)*2;/*TODO: _SCORE_CELLS_MULTIPLIER if partial rewards 0 otherwise*/
                }
    }else
    if ($isEmptyCell(state, ir, ic)) {
        grid[ir][ic] = _GRID_CELL.TILE;
        grid[loc.row][loc.column] = $isCharger(state, loc.row, loc.column)?
                                        _GRID_CELL.BATTERY_CHARGER : _GRID_CELL.EMPTY;
        grid[loc.row+r][loc.column+c] = _GRID_CELL.AGENT;

        state.agent.stats.battery_used+= costs.battery.slide_tile;
        state.agent.battery -= costs.battery.slide_tile;

        for (var i=env.tiles.length; i--;)
            if (env.tiles[i].row == loc.row+r &&
                env.tiles[i].column == loc.column+c)
            {
                env.tiles[i].row = ir;
                env.tiles[i].column = ic;
                break;
            }
    }

    loc.row = loc.row+r;
    loc.column = loc.column+c;
    state.agent.battery = state.agent.battery >= 0? state.agent.battery : 0; 
    return state;
}var $succesor = $result;

function $Node(e, p, a, g, d){
    this.State = e;     // The state in the state space to which the node corresponds
    this.Parent = p;    // The node in the search tree that generated this node
    this.Action = a;    // The action that was applied to the parent to gennerate the node
    this.g = g||0;         // The cost of the path from the initial state to the node, as indicated by the parent pointers
    this.Depth = d||0;     // depth of the node in the search tree

    // used for informed search strategies
   /* public int f()
    {
        switch (Busqueda.estrategia)
        {
            case EstrategiaBusqueda.AEstrella:
                return g + h();
            case EstrategiaBusqueda.Greedy:
                return h();
            case EstrategiaBusqueda.UniformCost:
                return g;
        }
        return int.MaxValue;
    }

    //Funcion heuristica
    public int h()
    {
        if (Busqueda.problemaActual.xyObjetivo.X == -1) //Si "xyObjetivo == null", es decir, si "el objetivo del problema está implicito" entonces...
            return estado.cantComida;
        else //Si es explicito (un punto al donde ir)
            return Util.celdasDistanciaManhattan(
                        estado.xPacman, estado.yPacman,
                        Busqueda.problemaActual.xyObjetivo.X, Busqueda.problemaActual.xyObjetivo.Y
                    ) * Util._RECOMPENZA;

    }*/
}

function $expand(node){
    var successors;

    if (node.State.agent.battery == 0)
        return [new $Node(
            $result(node.State, _ACTION.RESTORE),
            node,
            _ACTION.RESTORE,
            node.g + 1,
            node.Depth + 1
        )];

    successors = [];

    if ($isValidMove(node.State, _ACTION.WEST))
        successors.push(new $Node(
            $result(node.State, _ACTION.WEST),
            node,
            _ACTION.WEST,
            node.g + 1,
            node.Depth + 1
        ));

    if ($isValidMove(node.State, _ACTION.EAST))
        successors.push(new $Node(
            $result(node.State, _ACTION.EAST),
            node,
            _ACTION.EAST,
            node.g + 1,
            node.Depth + 1
        ));

    if ($isValidMove(node.State, _ACTION.NORTH))
        successors.push(new $Node(
            $result(node.State, _ACTION.NORTH),
            node,
            _ACTION.NORTH,
            node.g + 1,
            node.Depth + 1
        ));

    if ($isValidMove(node.State, _ACTION.SOUTH))
        successors.push(new $Node(
            $result(node.State, _ACTION.SOUTH),
            node,
            _ACTION.SOUTH,
            node.g + 1,
            node.Depth + 1
        ));

    return successors;
}

function $solution(node, seq, limit, percept, goal, delay, equalByState, solution){
    var painted = !!seq;
    if (!painted) seq = [];
    else $clearPaintedCells();

    for (; node && node.Action !== undefined; node = node.Parent)
        seq.push(node.Action);

    //if iterative depth first search
    if (!seq.length && limit){
        search(percept, goal, 2, true, delay, equalByState, limit+1, solution);
        return;
    }
    __thinking__ = false;
   return seq.reverse();
}

function $breadthFirstSearch(percept, goal, paint, delay, equalByState){ return search(percept, goal, 0, paint, delay, equalByState); }
function $depthFirstSearch(percept, goal, paint, delay, equalByState){ return search(percept, goal, 1, paint, delay, equalByState); }
function $depthLimitedSearch(percept, goal, limit, paint, delay, equalByState){ return search(percept, goal, 1, paint, delay, equalByState, limit); }
function $iterativeDepthFirstSearch(percept, goal, paint, delay, equalByState){
    var seq, limit=limit||0;
    if (!paint)
        while(13){
            seq = $depthLimitedSearch(percept, goal, ++limit, paint, delay, equalByState)
            if (seq.length) return seq;
        }
    else
        return search(percept, goal, 2, paint, delay, equalByState, limit+1);
}

//equalByState: whether or not states are going to be considered equal according to the structure of the goal state or the entire state 
function search(percept, goal, type, paint, delay, equalByState, limit, solution){delay=delay||150;
    var initial_state = percept;
    var node = new $Node(initial_state);
    var solution = solution || [];
    var frontier = [node];
    var explored = [];

    var children;
    var child = {State: copy(goal) };

    if ( match(node.State, goal) ) return $solution(node, solution, type==2?limit:null, percept, goal, delay, equalByState, solution);

    if (paint){

        __thinking__ = true;
        function infiniteLoop(){
            if ( !frontier.length ) return $solution(null, solution, type==2?limit:null, percept, goal, delay, equalByState, solution);

            switch(type){
                case 0: node = frontier.shift(); break;
                case 1:
                case 2: node = frontier.pop()  ; break;
            } 

             $paintCell(node.State.agent.location.row, node.State.agent.location.column);

            setTimeout(function(){
                explored.push( node.State );

                if (!limit || node.Depth < limit){
                    children = $expand(node);

                    for (var n=children.length; n--;){

                        if (!equalByState)
                            instantiate(child.State, children[n].State);
                        else
                            child.State = children[n].State;

                        if ( !explored.containsMatch(child.State) && !frontier.containsMatch(child) ){
                            if (match(child.State, goal)) return $solution(children[n], solution, type==2?limit:null, percept, goal, delay, equalByState, solution);
                            frontier.push(children[n]);
                       }
                    }
                }
                infiniteLoop();
            }
            ,delay);
        }
        infiniteLoop();
        return solution;

    }else{

        while(13){//infinite loop
            if ( !frontier.length ) return [];

            switch(type){
                case 0: node = frontier.shift(); break;
                case 1: node = frontier.pop()  ; break;
            } 

            explored.push( node.State );

             if (!limit || node.Depth < limit){
                children = $expand(node);

                for (var n=children.length; n--;){

                    if (!equalByState)
                        instantiate(child.State, children[n].State);
                    else
                        child.State = children[n].State;

                    if ( !explored.containsMatch(child.State) && !frontier.containsMatch(child) ){
                        if (match(child.State, goal)) return $solution(children[n]);
                        frontier.push(children[n]);
                   }
                }
            }
        }

    }
}

function $paintCell(row, column){$return(_ACTION.PAINT_CELL+row+":"+column)}

function $clearPaintedCells(){$return(_ACTION.CLEAR_CELLS)}

function $nextAction(arrayOfActions){
    return (!arrayOfActions || arrayOfActions.length == 0)? _ACTION.NONE : arrayOfActions.shift();
}

function $randomAction(){return random(6)}

function $randomValidAction(percept /*n,s,w,e*/){
    var actions = new Array();

    if ($isValidMove(percept, _ACTION.NORTH))
        actions.push(_ACTION.NORTH);

    if ($isValidMove(percept, _ACTION.SOUTH))
        actions.push(_ACTION.SOUTH);

    if ($isValidMove(percept, _ACTION.EAST))
        actions.push(percept, _ACTION.EAST);

    if ($isValidMove(percept, _ACTION.WEST))
        actions.push(_ACTION.WEST);

    return (actions.length == 0)? _ACTION.NONE : actions[parseInt(Math.random()*actions.length)];
}

function $return(action){
    switch(action){
        case _ACTION.NORTH:
        case _ACTION.SOUTH:
        case _ACTION.WEST:
        case _ACTION.EAST:
        case _ACTION.NONE:
        case _ACTION.RESTORE:
            _ACTION_SENT = true;
    }
    postMessage(action);
}

function $sendTeamMessage(msg){
    $return(_ACTION.TEAM_MESSAGE + JSON.stringify(msg));
}

function $sendMessage(robId, msg){
    $return(_ACTION.PEER_MESSAGE + robId + ":" + JSON.stringify(msg));
}

function $perceive(){postMessage(_ACTION.NONE)}





function $isValidCoordinates(percept, row, column) {var _grid= percept.environment.grid;
    return (0 <= row && row < _grid.length)&&(0 <= column && column < _grid[0].length);
}

function $isEmptyCell(percept, row, column) {var _grid= percept.environment.grid;
    return  $isValidCoordinates(percept, row,column)&&
            (_grid[row][column] == _GRID_CELL.EMPTY);
}

function $isHoleCell(percept, row, column) {var _grid= percept.environment.grid;
    return  $isValidCoordinates(percept, row,column)&&
            (_grid[row][column] === (_grid[row][column]|0));
}

function $isTile(percept, row, column) {var _grid= percept.environment.grid;
    return  $isValidCoordinates(percept, row,column)&&
            (_grid[row][column] == _GRID_CELL.TILE);
}

function $isAgent(percept, row, column) {var _grid= percept.environment.grid;
    return  $isValidCoordinates(percept, row,column)&&
            (_grid[row][column] == _GRID_CELL.AGENT);
}

function $isObstacle(percept, row, column) {var _grid= percept.environment.grid;
    return  $isValidCoordinates(percept, row,column)&&
            (_grid[row][column] == _GRID_CELL.OBSTACLE);
}

function $isCharger(percept, row, column) {var _bChargerLoc= percept.environment.battery_chargers;
    for (var bc = _bChargerLoc.length; bc--;)
        if (_bChargerLoc[bc].row == row && _bChargerLoc[bc].column == column)
            return bc+1;
    return 0;
}

function $isValidMove(percept, move){
    var arow, acol;
    var r = 0, c = 0;
    var _GRID = percept.environment.grid;
        _GRID.ROWS = _GRID.length;
        _GRID.COLUMNS = _GRID[0].length;

    if (move === undefined){
        arow = _AGENT.location.row;
        acol = _AGENT.location.column;
        move = percept;
    }else{
        arow = percept.agent.location.row;
        acol = percept.agent.location.column;
    }

    switch(move){
        case _ACTION.NORTH:
            if (arow <= 0)
                return false;
            r = -1;
            break;
        case _ACTION.SOUTH:
            if (arow >= _GRID.ROWS-1)
                return false;
            r = 1;
            break;
        case _ACTION.WEST:
            if (acol <= 0)
                return false;
            c = -1;
            break;
        case _ACTION.EAST:
            if (acol >= _GRID.COLUMNS-1)
                return false;
            c = 1;
    }

    if (_GRID[arow+r][acol+c] == _GRID_CELL.TILE){
        var tr = r, tc = c;
        for (; _GRID[arow+tr][acol+tc] == _GRID_CELL.TILE; tr+= r, tc+= c)
            if ( arow+tr+r < 0 || arow+tr+r > _GRID.ROWS-1 ||
                 acol+tc+c < 0 || acol+tc+c > _GRID.COLUMNS-1)
                return false;
        r = tr;
        c = tc;
        return  !$isObstacle(percept, arow+r, acol+c) &&
                !$isAgent(percept, arow+r, acol+c);
    }

    return  !$isHoleCell(percept, arow+r, acol+c) &&
            !$isObstacle(percept, arow+r, acol+c) &&
            !$isAgent(percept, arow+r, acol+c);
}




function $printGrid(percept, noClear){
    var strgLine = "   ";
    var strgGrid = "";
    var _GRID = percept.environment.grid;
        _GRID.ROWS = _GRID.length;
        _GRID.COLUMNS = _GRID[0].length;

    for (var i=0; i < _GRID.COLUMNS; ++i)
        strgLine+="-  ";
    strgLine+= "\n";

    for (var i=0; i < _GRID.ROWS; ++i){
        strgGrid+= "|  ";

        for (var j=0; j < _GRID.COLUMNS; ++j)
        strgGrid+= (isNaN(parseInt(_GRID[i][j])) || _GRID[i][j] < 10)?
                _GRID[i][j]+"  " :
                ((_GRID[i][j] < 100)?
                    _GRID[i][j]+" " :
                    _GRID[i][j]
                )

        strgGrid+= "|\n";
    }

    if (!noClear)
        console.clear();
    console.log(
        "\n" +
        strgLine+
        strgGrid+
        strgLine+
        "Score: " + percept.agent.score+
        "\t Battery: " + percept.agent.battery +
        "\t Time: " + percept.environment.time +
        "\n = = = = = = = = = = = = = = = = = = = = = = = = = = = "
    );
}