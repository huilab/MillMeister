function findExtents(scene) { 
	for(var child of scene.children) {
		var minX, maxX, minY, maxY;
		if(child.position) {
			minX = Math.min(child.position.x, minX);
			minY = Math.min(child.position.y, minY);
			maxX = Math.max(child.position.x, maxX);
			maxY = Math.max(child.position.y, maxY);
		}
	}

	return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY }};
}

function createGCodeScene(parent) {
	var $parent = $(parent);
	var width = $parent.innerWidth();
	var height = $parent.innerHeight();
	
	// Scene
  var scene = new THREE.Scene(); 
  scene.background = new THREE.Color( 0xFFFFFF );
  // Renderer
  var renderer = new THREE.WebGLRenderer( { alpha: true } );
  renderer.setClearColor( 0xffffff, 0 );
  renderer.setSize(width, height);
  $parent.append(renderer.domElement);
  renderer.clear();

  

  // Lights...
  [[0,0,1,  0xFFFFCC],
   [0,1,0,  0xFFCCFF],
   [1,0,0,  0xCCFFFF],
   [0,0,-1, 0xCCCCFF],
   [0,-1,0, 0xCCFFCC],
   [-1,0,0, 0xFFCCCC]].forEach(function(position) {
    var light = new THREE.DirectionalLight(position[3]);
    light.position.set(position[0], position[1], position[2]).normalize();
    scene.add(light);
  });

  // Camera...
  var fov    = 45,
      aspect = width / height,
      near   = 0.1,
      far    = 10000,
      camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.rotationAutoUpdate = true;
  
  camera.position.x = 0;
  camera.position.y = -50;
  camera.position.z = 50;
  camera.lookAt(scene.position);
  scene.add(camera);
  
  //add arrow helper
  var origin = new THREE.Vector3( 0, 0, 0 );
	var x_dir = new THREE.Vector3( 1, 0, 0 );
	var y_dir = new THREE.Vector3( 0, 1, 0 );
	var z_dir = new THREE.Vector3( 0, 0, 1 );
	
	//normalize the direction vectors (convert to vector of length 1)
	origin.normalize();
	x_dir.normalize();
	y_dir.normalize();
	z_dir.normalize();
	
	var length = 10;

	var arrowHelper = new THREE.ArrowHelper( x_dir, origin, length, 0xff0000, 0.2*length, 0.1*length );
	scene.add( arrowHelper );
	var arrowHelper2 = new THREE.ArrowHelper( y_dir, origin, length, 0x00ff00, 0.2*length, 0.1*length );
	scene.add( arrowHelper2 );
	var arrowHelper3 = new THREE.ArrowHelper( z_dir, origin, length, 0x0000ff, 0.2*length, 0.1*length );
	scene.add( arrowHelper3 );
	
	// create a set of coordinate axes to help orient user
	// specify length in pixels in each direction
	//var axes = new THREE.AxisHelper(100);
	//scene.add( axes );
	
  
  var controls = new THREE.TrackballControls(camera, parent);
  controls.screen.width = width;
  controls.screen.height = height;
  //controls.noPan = true;
  //controls.dynamicDampingFactor = 0.15;


var substrateLength = document.getElementById("inputPartExtentsX").value;
var substrateWidth = document.getElementById("inputPartExtentsY").value;
var substrateHeight = document.getElementById("inputSubstrateThickness").value;
var substrateGeo = new THREE.BoxGeometry( substrateLength, substrateWidth, substrateHeight );
var substrateMat = new THREE.MeshBasicMaterial( {color: 0x00ff00, transparent:true, opacity:0.5 } );
var substrateBox = new THREE.Mesh( substrateGeo, substrateMat );

//add the substrate geo to the scene
substrateBox.position.set(substrateLength/2, substrateWidth/2, -substrateHeight/2);
scene.add( substrateBox );


var gcodeViewGui = new dat.GUI( { autoPlace: false } );
var myContainer = document.getElementById('gcode-gui');
myContainer.appendChild(gcodeViewGui.domElement);
//gcodeViewGui.domElement.id = "gcode-gui";
var gui_controls = {
  reset: function() {
    camera.position.x = 0;
    camera.position.y = -50;
    camera.position.z = 50;
    camera.lookAt(scene.position);
  }
};

//var gcodeViewGui = new dat.GUI( );
//var  = gcodeViewGui.addFolder("Substrate");
gcodeViewGui.add( gui_controls, "reset" ).name("Reset camera");
gcodeViewGui.add( substrateBox, 'visible' ).name("Show substrate");

	

  // Action!
  function render() {
    controls.update();
    renderer.render(scene, camera);
    renderer.setClearColor(0xffffff, 1);
    requestAnimationFrame(render); // And repeat...
  }
  render();

  // Fix coordinates up if window is resized.
  $(window).on("resize", function() {
  	width = $parent.innerWidth();
	  height = $parent.innerHeight();
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    controls.screen.width = width;
  	controls.screen.height = height;
  });
  console.log("gcode scene created");
  return scene;
}
