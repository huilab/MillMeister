/**
 * Parses a string of gcode instructions, and invokes handlers for
 * each type of command.
 *
 * Special handler:
 *   "default": Called if no other handler matches.
 */
function GCodeParser( handlers ) {
  this.handlers = handlers || {};
	   /*if(isGroup01Modal == 0) { //G00
	     addLineHack(args, 0);
	   }
	   else if(isGroup01Modal == 1) { //G01
	     addLineHack(args, 1);
	   }
	   else {*/
}


GCodeParser.prototype.parseLine = function( text, info, mode) {
  if(text.charAt(0) == "(") {
  	return;
  }
  text = text.replace(/;.*$/, "").trim(); // Remove comments
  if ( text ) {
    var tokens = text.split(" ");
    if (tokens) {
      var cmd = tokens[0];
      var args = {
        "cmd": cmd
      };

      if(args.cmd == "G00") {
        mode.group01Modal = "G00";
      }
      if(args.cmd == "G01") {
        mode.group01Modal = "G01";
      }
      
      tokens.splice(1).forEach(function( token ) {
      	//console.log("splicing:",token);
      	if( token ) {
        	var key = token[0].toLowerCase();
        	var value = parseFloat( token.substring(1) );
        	args[ key ] = value;
        }
      });
      var handler = this.handlers[ args.cmd ] || this.handlers["default"];
      if (handler) {
        if( handler == this.handlers["default"] && mode.group01Modal != "None") {
          var key = args.cmd[0].toLowerCase();
        	var value = parseFloat( args.cmd.substring(1) );
        	args[ key ] = value;
          args.cmd = mode.group01Modal;
          var handler = this.handlers[ args.cmd ] || this.handlers["default"];
        }
        return handler(args, info);
      }
      else {
        console.log("GCodeParser::warning: no handler for token:",token);
      }
    }
  }
};

GCodeParser.prototype.parse = function( gcode ) {
  var mode = {group01Modal: "None"};
  var lines = gcode.split("\n");
  for ( var i = 0; i < lines.length; i++ ) {
    if ( this.parseLine( lines[i], i, mode) === false ) {
      break;
    }
  }
};
