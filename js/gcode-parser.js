/**
 * Parses a string of gcode instructions, and invokes handlers for
 * each type of command.
 *
 * Special handler:
 *   'default': Called if no other handler matches.
 */
function GCodeParser(handlers) {
  this.handlers = handlers || {};
}

GCodeParser.prototype.parseLine = function(text, info) {
  //console.log("parsing line:", info);
  if(text.charAt(0) == '(') {
  	return;
  }
  text = text.replace(/;.*$/, '').trim(); // Remove comments
  if (text) {
  	//console.log("text:",text);
    var tokens = text.split(' ');
    if (tokens) {
      var cmd = tokens[0];
      var args = {
        'cmd': cmd
      };
      
      //G1 Z1.0 F3000
      //console.log("tokens:",tokens);
      tokens.splice(1).forEach(function(token) {
      	//console.log("splicing:",token);
      	if(token) {
        	var key = token[0].toLowerCase();
        	var value = parseFloat(token.substring(1));
        	args[key] = value;
        }
      });
      var handler = this.handlers[tokens[0]] || this.handlers['default'];
      if (handler) {
        return handler(args, info);
      }
    }
  }
};

GCodeParser.prototype.parse = function(gcode) {
  var lines = gcode.split('\n');
  for (var i = 0; i < lines.length; i++) {
    if (this.parseLine(lines[i], i) === false) {
      break;
    }
  }
};
