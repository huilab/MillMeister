// GCode descriptions come from:
// http://reprap.org/wiki/G-code
// http://en.wikipedia.org/wiki/G-code
// SprintRun source code
function createObjectFromGCode(gcode, scene) {
    var lastLine = {x:0, y:0, z:0, e:0, f:0, extruding:false};
    //an array to hold groups of lines
    //groups will include: solid lines (linear motion)
    //dashed lines (rapid motion)
    //and circles (drill coordinates)
    
    var rapid_material = new THREE.LineDashedMaterial( {
					color: 0x0000ff,
					linewidth: 1,
					scale: 1,
					dashSize: 1,
					gapSize: 3 } )// dashed line for rapid motion
					
	var linear_material = new THREE.LineBasicMaterial({
		color: 0x000000,
		linewidth: 2 } );// solid line for linear motion
	var circleMaterial = new THREE.LineBasicMaterial( { color: 0xff0000 } );
		
    var layers = [];
    var lines = [];
    var circles = [];
 	//var layer = undefined;
 	var bbbox = { min: { x:100000,y:100000,z:100000 }, max: { x:-100000,y:-100000,z:-100000 } };
 	
 	//adds a new layer
 	/*function newLayer(line) {
 		layer = { type: {}, layer: layers.count(), z: line.z, };
 		layers.push(layer);
 	}*/
 	
 	//
 	/*function getLineGroup(line) {
 		if (layer == undefined)
 			newLayer(line);
 		var speed = Math.round(line.e / 1000);
 		var grouptype = (line.extruding ? 10000 : 0) + speed;
 		//var color = new THREE.Color(line.extruding ? 0xffffff : 0x0000ff);
 		//var color = line.lineType ? 0x000000 : 0x0000ff;
 		
 		if (layer.type[grouptype] == undefined) {
 			var lineMaterial;
 			var line_color = line.lineType ? 0x000000 : 0x0000ff;
			if(line.lineType == 0) { // rapid motion
				lineMaterial = new THREE.LineDashedMaterial( {
					color: line_color,
					linewidth: 1,
					scale: 1,
					dashSize: 1,
					gapSize: 3 } );
			}
			else { //linear motion
				lineMaterial = new THREE.LineBasicMaterial({
					color: line_color,
					opacity:line.extruding ? 0.5 : 0.4,
					transparent: true,
					linewidth: 2,
					vertexColors: THREE.FaceColors } );
			}
 			layer.type[grouptype] = {
 				type: grouptype,
 				feed: line.e,
 				extruding: line.extruding,
 				color: line_color,
 				segmentCount: 0,
 				material: lineMaterial,
				geometry: new THREE.Geometry(),
			}
		}
		
		return layer.type[grouptype];
 	}*/
 	
 	// p1 is the last line
 	// p2 is the new line
 	function addSegment(p1, p2, material) {
 	    var geometry = new THREE.Geometry();
        geometry.vertices.push(
            new THREE.Vector3(p1.x, p1.y, p1.z));
        geometry.vertices.push(
            new THREE.Vector3(p2.x, p2.y, p2.z));
        //geometry.colors.push(p1.color);
        //geometry.colors.push(p2.color);
        var line = new THREE.Line(geometry, material);
        lines.push(line);
 	}//addSegment
 	
 	function addCircleMark(coordinates, material) {
 		var length  = coordinates.z/2,
    	//segments = 8,
    	geometry = new THREE.Geometry();
    	
    	/*for (var i = 0; i <= segments; i++) {
    		var theta = (i / segments) * Math.PI * 2;
			geometry.vertices.push(
			 	new THREE.Vector3(
				Math.cos(theta) * radius + coordinates.x,
				Math.sin(theta) * radius + coordinates.y,
				0)
			);            
		}*/
		
		//var theta = (i / segmentCount) * Math.PI * 2;
		var theta = Math.PI*2*(1/8);
		geometry.vertices.push(
		new THREE.Vector3(coordinates.x + (Math.cos(theta) * length), coordinates.y + (Math.sin(theta) * length), 0)
		);
		geometry.vertices.push(
		new THREE.Vector3(coordinates.x - (Math.cos(theta) * length), coordinates.y - (Math.sin(theta) * length), 0)
		);
		
		theta = Math.PI*2*(3/8);
		geometry.vertices.push(
		new THREE.Vector3(coordinates.x + (Math.cos(theta) * length), coordinates.y + (Math.sin(theta) * length), 0)
		);
		geometry.vertices.push(
		new THREE.Vector3(coordinates.x - (Math.cos(theta) * length), coordinates.y - (Math.sin(theta) * length), 0)
		);
		
    	//geometry = new THREE.CircleGeometry( radius, segments );

		// Remove center vertex
		//geometry.vertices.shift();

		// Non closed circle with one open segment:
		//scene.add( new THREE.Line( geometry, material ) );

		// To get a closed circle use LineLoop instead (see also @jackrugile his comment):
		//var circle = new THREE.LineLoop( geometry, material );
		var line = new THREE.Line(geometry, material);
		circles.push(line);
 	}
 	
  	var relative = false;
  	
	function delta(v1, v2) {
		return relative ? v2 : v2 - v1;
	}
	function absolute (v1, v2) {
		return relative ? v1 + v2 : v2;
	}

	//create a new parser object and feed it array of handlers
  var parser = new GCodeParser({  	
    G00: function(args) {
      // G00: Rapid motion
      //determine the coordinates of the new line
      var newLine = {
        x: args.x !== undefined ? absolute(lastLine.x, args.x) : lastLine.x,
        y: args.y !== undefined ? absolute(lastLine.y, args.y) : lastLine.y,
        z: args.z !== undefined ? absolute(lastLine.z, args.z) : lastLine.z,
        e: args.e !== undefined ? absolute(lastLine.e, args.e) : lastLine.e,
        f: args.f !== undefined ? absolute(lastLine.f, args.f) : lastLine.f
      };
      
		addSegment(lastLine, newLine, rapid_material);
      	lastLine = newLine;
    },
    
    G01: function(args) {
      // G01: Linear interpolated motion
      // Example: G1 Z1.0 F3000
      //          G1 X99.9948 Y80.0611 Z15.0 F1500.0 E981.64869
      //          G1 E104.25841 F1800.0
      // Go in a straight line from the current (X, Y) point
      // to the point (90.6, 13.8), extruding material as the move
      // happens from the current extruded length to a length of
      // 22.4 mm.
		//console.log("processing G01");
      var newLine = {
        x: args.x !== undefined ? absolute(lastLine.x, args.x) : lastLine.x,
        y: args.y !== undefined ? absolute(lastLine.y, args.y) : lastLine.y,
        z: args.z !== undefined ? absolute(lastLine.z, args.z) : lastLine.z,
        e: args.e !== undefined ? absolute(lastLine.e, args.e) : lastLine.e,
        f: args.f !== undefined ? absolute(lastLine.f, args.f) : lastLine.f
      };
		
		//newLine.lineType = 1; // solid line for linear motion
		addSegment(lastLine, newLine, linear_material);
      	lastLine = newLine;
    },

    G21: function(args) {
      // G21: Set Units to Millimeters
      // Example: G21
      // Units from now on are in millimeters.

      // No-op: So long as G20 is not supported.
    },
    
    G83: function(args) {
      // G83: Canned peck cycle
      // TK Mark location with a red X
      var coordinates = {
		  x: args.x !== undefined ? absolute(lastLine.x, args.x) : lastLine.x,
		  y: args.y !== undefined ? absolute(lastLine.y, args.y) : lastLine.y,
		  z: args.z !== undefined ? absolute(lastLine.z, args.z) : lastLine.z
      };
      
      addCircleMark(coordinates, circleMaterial);
      
    },
    
    G90: function(args) {
      // G90: Set to Absolute Positioning
      // Example: G90
      // All coordinates from now on are absolute relative to the
      // origin of the machine.

      relative = false;
    },

    G91: function(args) {
      // G91: Set to Relative Positioning
      // Example: G91
      // All coordinates from now on are relative to the last position.

      // TODO!
      relative = true;
    },

    G92: function(args) { // E0
      // G92: Set Position
      // Example: G92 E0
      // Allows programming of absolute zero point, by reseting the
      // current position to the values specified. This would set the
      // machine's X coordinate to 10, and the extrude coordinate to 90.
      // No physical motion will occur.

      // TODO: Only support E0
      var newLine = lastLine;
      newLine.x= args.x !== undefined ? args.x : newLine.x;
      newLine.y= args.y !== undefined ? args.y : newLine.y;
      newLine.z= args.z !== undefined ? args.z : newLine.z;
      newLine.e= args.e !== undefined ? args.e : newLine.e;
      lastLine = newLine;
    },

    M82: function(args) {
      // M82: Set E codes absolute (default)
      // Descriped in Sprintrun source code.

      // No-op, so long as M83 is not supported.
    },

    M84: function(args) {
      // M84: Stop idle hold
      // Example: M84
      // Stop the idle hold on all axis and extruder. In some cases the
      // idle hold causes annoying noises, which can be stopped by
      // disabling the hold. Be aware that by disabling idle hold during
      // printing, you will get quality issues. This is recommended only
      // in between or after printjobs.

      // No-op
    },

    'default': function(args, info) {
      console.warn('Gcode Model::Unknown command:', args.cmd, args, info);
    },
  });
  
  console.log("Gcode Model::Parsing gcode... ");
  parser.parse(gcode);

	//if(layers
 //console.log("Gcode Model::Layer Count ", layers.length);

  var object = new THREE.Object3D();
  for (var idx in lines) {
  	var line = lines[idx];
  	 //scene.add(line);
  	 object.add(line);
  	//object.add(new THREE.Line(group.geometry, group.material, THREE.LineSegments));
  }
  for (var idx in circles) {
     var circle = circles[idx];
  	 //scene.add(line);
  	 object.add(circle);
  }
	/*
	for (var lid in layers) {
		var layer = layers[lid];
//		console.log("Layer ", layer.layer);
		for (var tid in layer.type) {
			var type = layer.type[tid];
			console.log("Layer ", layer.layer, " type ", type.type, " seg ", type.segmentCount);
		  object.add(new THREE.Line(type.geometry, type.material, THREE.LineSegments));
		}
	}*/
	console.log("bbox ", bbbox);

  // Center
  var scale = 3; // TODO: Auto size

  var center = new THREE.Vector3(
  		bbbox.min.x + ((bbbox.max.x - bbbox.min.x) / 2),
  		bbbox.min.y + ((bbbox.max.y - bbbox.min.y) / 2),
  		bbbox.min.z + ((bbbox.max.z - bbbox.min.z) / 2));
	console.log("center ", center);
  
  object.position = center.multiplyScalar(-scale);

  object.scale.multiplyScalar(scale);

	scene.add(object);
}
