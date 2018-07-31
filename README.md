
# MillMeister

**MillMeister.io** is a javascript tool path generator designed for microfluidics. 
It parses a dxf file, automatically detects milling parameters based on layer names, generates the tool paths, and stores them in a gcode (*.nc) file.
The gcode is parsed and rendered as a 3D model using three.js.
 
#### Usage
* Load DXF
* Check process parameters
* Export gcode and job info

#### Run Locally

Clone the repo
Uncomment and check the path to your preferred browser in startserver.py
```
> cd MillMeister
> python startserver.py
# start a server on localhost:8000 and open MillMeister.io in your favorite browser
````
#### Makes use of
* https://github.com/gdsestimating/three-dxf
* https://github.com/gdsestimating/dxf-parser

#### Todo
* Reduce movement: http://parano.github.io/GeneticAlgorithm-TSP/

#### Contributors
ewerner@uci.edu
