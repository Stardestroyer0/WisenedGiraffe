import React, {Component} from 'react';
import {svgKeyDown, svgKeyUp} from './keyboardEvents';
import {deselect_path_and_nodes, initSimulation, updateGraph, zoom_actions} from './graphActions';
import {appendMarkerAttributes} from './markerActions';

import * as d3 from 'd3';
import {add_node} from './nodeActions';
import {parse, stringify} from 'flatted/esm';
import JSONC from 'jsoncomp';
import pako from 'pako';
import Base64 from 'Base64';

const styles = theme => ({
  tooltip: {
    position: 'absolute',
    textAlign: 'center',
    padding: 2,
    font: '12px sans-serif',
    background: 'lightsteelblue',
    border: 0,
    borderRadius: 8,
    pointerEvents: 'none',
    zIndex: 1202
  }
});

class GraphSvg extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  addNode(nodeData) {
    add_node(nodeData, this);
    console.log(JSON.stringify(nodeData));
  }

  resetCamera() {
    this.inputSvg.transition()
      .duration(750)
      .call(this.zoom_handler.transform, d3.zoomIdentity);

    this.updateGraphHelper();
  }

  jiggle() {
    this.graphData.nodes.forEach(node => {
      node.x = 0;
      node.y = 0;
    });

    this.updateGraphHelper();
  }

  fixNodes() {
    this.graphData.nodes.forEach(node => {
      node.fx = node.x;
      node.fy = node.y;
    });

    this.updateGraphHelper();
  }

  unfixNodes() {
    this.graphData.nodes.forEach(node => {
      node.fx = null;
      node.fy = null;
      node.vx = 0;
      node.vy  = 0;
    });

    this.updateGraphHelper();
  }

  createGraph(inputSvg, nodes = [], links = [], data = {}) {
    this.graphData = {
      nodes: nodes,
      links: links
    };

    this.id = Math.max(...(this.graphData.nodes.map(elem => elem.id))) + 1;
    if (this.id === Number.NEGATIVE_INFINITY) {
      this.id = 0;
    }
    this.inputSvg = inputSvg;

    //add encompassing group for the zoom
    this.svgGroup = inputSvg.append('g')
      .attr('class', 'objects')
      .attr('id', 'svgGroup');

    const graphObjects = this.svgGroup;

    const t = this;

    inputSvg.on('click', function (d) {
      deselect_path_and_nodes.call(this, t);
    });

    d3.select(window).on('keydown', function (d) {
      svgKeyDown.call(this, d, t);
    }).on('keyup', function (d) {
      svgKeyUp.call(this, d, t);
    });

    //add zoom capabilities
    this.zoom_handler = d3.zoom()
      .on('zoom', () => zoom_actions(graphObjects))
      .scaleExtent([0.1, 6]);
    this.zoom_handler(inputSvg);
    inputSvg.on('dblclick.zoom', null);

    //Create definitions for the arrow markers showing relationship directions
    const defs = graphObjects.append('defs');
    appendMarkerAttributes(defs.append('svg:marker')
      .attr('id', 'default-path-arrow')
      .attr('refX', 35));

    appendMarkerAttributes(defs.append('svg:marker')
      .attr('id', 'highlight-path-arrow-orange')
      .attr('fill', 'orange')
      .attr('refX', 24));

    appendMarkerAttributes(defs.append('svg:marker')
      .attr('id', 'dragged-end-arrow')
      .attr('refX', 7));

    const filter = defs.append('filter')
      .attr('id', 'drop-shadow')
      .attr('height', '130%')
      .attr('width', '130%')
      .attr('filterUnits', 'userSpaceOnUse');

    filter.append('feGaussianBlur')
      .attr('in', 'SourceAlpha')
      .attr('stdDeviation', 5)
      .attr('result', 'blur');

    filter.append('feOffset')
      .attr('in', 'blur')
      .attr('result', 'offsetBlur');

    filter.append('feFlood')
      .attr('in', 'offsetBlur')
      .attr('flood-color','white')
      .attr('flood-opacity', '1')
      .attr('result', 'offsetColor');

    filter.append('feComposite')
      .attr('in', 'offsetColor')
      .attr('in2', 'offsetBlur')
      .attr('operator', 'in')
      .attr('result', 'offsetBlur');

    const feMerge = filter.append('feMerge');

    feMerge.append('feMergeNode')
      .attr('in', 'offsetBlur');
    feMerge.append('feMergeNode')
      .attr('in', 'SourceGraphic');


    //The dragged line
    this.dragLine = graphObjects.append('g').append('svg:path')
      .attr('class', 'link dragline line-object hidden')
      .attr('d', 'M0,0L0,0')
      .attr('stroke', function (d) {
        return d3.color('#000000');
      })
      .style('marker-end', 'url(#dragged-end-arrow)');

    const graphLinksGroup = graphObjects.append('g') //graphLinksData
      .attr('class', 'links-g-group');

    const graphNodesGroup = graphObjects
      .append('g')
      .attr('class', 'nodes-g-group');

    let simulation = initSimulation();

    this.graphNodesGroup = graphNodesGroup;
    this.graphLinksGroup = graphLinksGroup;
    this.simulation = simulation;
    this.updateGraphHelper();
  }

  updateGraphHelper() {
    updateGraph.call(this, this.simulation, this.graphNodesGroup, this.graphLinksGroup);
  }

  clearGraphDataRaw() {
    const parent = d3.select(d3.select('#mainRender').node().parentElement);
    d3.select('#mainRender').selectAll('*').remove();
    d3.select('#mainRender').remove();

    return parent.append('svg').attr('id', 'mainRender');
  }

  clearGraphData() {
    deselect_path_and_nodes.call(this, t);
    const svg = this.clearGraphDataRaw();
    this.createGraph(svg);
  }

  loadGraphData(data) {
    const svg = this.clearGraphDataRaw();
    //nodes, links, data
    this.createGraph(svg, data.graphData.nodes, data.graphData.links);
  }

  compressGraphData() {
    const compressedData = {
      version: 0.01,
      graphData: this.graphData,
      playerData: {},
      secret: {}
    };
    return Base64.btoa(pako.deflate(stringify(compressedData), { to: 'string' }));
  }

  inflateGraphData(data) {
    return parse(pako.inflate(Base64.atob(data),  { to: 'string' }));
  }


  componentDidMount() {
    console.log(this);
    const svg = d3.select('#mainRender');

    let id = 0;
    const graphData = {
      'nodes': [
        {'data':{'recipe':{'name':'Iron Ingot','inputs':[{'quantity':1,'item':{'name':'Iron Ore','icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Iron_Ore.png','hidden':false,'id':1}}],'time':2,'power':4,'quantity':1,'hidden':false,'id':0,'machine_class':{'name':'Smelter','plural':'Smelters','icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Smelter.png','hidden':false,'id':3},'item':{'name':'Iron Ingot','icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Iron_Ingot.png','hidden':false,'id':4}}},'machine':{'name':'Smelter','plural':'Smelters','icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Smelter.png','hidden':false,'id':3},'allowedIn':[1],'allowedOut':[4],'instance':{'name':'Smelter Mk.1','speed':100,'icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Smelter.png','input_slots':1,'output_slots':1,'hidden':false,'id':5,'node_type':{'name':'Machine Node','hidden':false,'id':0},'machine_version':{'name':'Mk.1','rank':0,'representation':'I','hidden':false,'id':1},'machine_class':{'name':'Smelter','plural':'Smelters','icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Smelter.png','hidden':false,'id':3}},'upgradeTypes':[{'name':'Smelter Mk.1','speed':100,'icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Smelter.png','input_slots':1,'output_slots':1,'hidden':false,'id':5,'node_type':{'name':'Machine Node','hidden':false,'id':0},'machine_version':{'name':'Mk.1','rank':0,'representation':'I','hidden':false,'id':1},'machine_class':{'name':'Smelter','plural':'Smelters','icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Smelter.png','hidden':false,'id':3}},{'name':'Smelter Mk.2','icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Smelter.png','speed':100,'hidden':true,'input_slots':1,'output_slots':1,'id':6,'node_type':{'name':'Machine Node','hidden':false,'id':0},'machine_version':{'name':'Mk.2','rank':1,'representation':'II','hidden':false,'id':2},'machine_class':{'name':'Smelter','plural':'Smelters','icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Smelter.png','hidden':false,'id':3}}],'id':3,'x':0,'y':0,'overclock':100,'open_in_slots':1,'open_out_slot':1,'index':1,'vy':0,'vx':0},
        {'data':{'recipe':{'name':'Iron Plate','inputs':[{'quantity':12,'item':{'name':'Iron Ingot','icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Iron_Ingot.png','hidden':false,'id':4}}],'time':4,'power':4,'quantity':1,'hidden':false,'id':3,'machine_class':{'name':'Constructor','plural':'Constructors','icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Constructor.png','hidden':false,'id':0},'item':{'name':'Iron Plate','icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Iron_Plate.png','hidden':false,'id':6}}},'machine':{'name':'Constructor','plural':'Constructors','icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Constructor.png','hidden':false,'id':0},'allowedIn':[4],'allowedOut':[6],'instance':{'name':'Constructor Mk.1','icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Constructor.png','speed':100,'input_slots':1,'output_slots':1,'hidden':false,'id':7,'node_type':{'name':'Machine Node','hidden':false,'id':0},'machine_version':{'name':'Mk.1','rank':0,'representation':'I','hidden':false,'id':1},'machine_class':{'name':'Constructor','plural':'Constructors','icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Constructor.png','hidden':false,'id':0}},'upgradeTypes':[{'name':'Constructor Mk.1','icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Constructor.png','speed':100,'input_slots':1,'output_slots':1,'hidden':false,'id':7,'node_type':{'name':'Machine Node','hidden':false,'id':0},'machine_version':{'name':'Mk.1','rank':0,'representation':'I','hidden':false,'id':1},'machine_class':{'name':'Constructor','plural':'Constructors','icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Constructor.png','hidden':false,'id':0}},{'name':'Constructor Mk.2','icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Constructor.png','speed':100,'hidden':true,'input_slots':1,'output_slots':1,'id':8,'node_type':{'name':'Machine Node','hidden':false,'id':0},'machine_version':{'name':'Mk.2','rank':1,'representation':'II','hidden':false,'id':2},'machine_class':{'name':'Constructor','plural':'Constructors','icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Constructor.png','hidden':false,'id':0}}],'id':3,'x':0,'y':0,'overclock':100,'open_in_slots':1,'open_out_slot':1,'index':3,'vy':0,'vx':0},
        {'data':{'recipe':{'hidden':false,'id':5,'machine_class':{'name':'Container','plural':'Containers','icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Storage_Container_MK1.png','hidden':false,'id':6},'spring_type':{'name':'Container','hidden':false,'id':1}}},'machine':{'name':'Container','plural':'Containers','icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Storage_Container_MK1.png','hidden':false,'id':6},'allowedIn':[],'allowedOut':[],'instance':{'name':'Container','speed':999999,'icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Storage_Container_MK1.png','input_slots':1,'output_slots':1,'hidden':false,'id':0,'node_type':{'name':'Machine Node','hidden':false,'id':0},'machine_version':{'name':'Mk.1','rank':0,'representation':'I','hidden':false,'id':1},'machine_class':{'name':'Container','plural':'Containers','icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Storage_Container_MK1.png','hidden':false,'id':6}},'upgradeTypes':[{'name':'Container','speed':999999,'icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Storage_Container_MK1.png','input_slots':1,'output_slots':1,'hidden':false,'id':0,'node_type':{'name':'Machine Node','hidden':false,'id':0},'machine_version':{'name':'Mk.1','rank':0,'representation':'I','hidden':false,'id':1},'machine_class':{'name':'Container','plural':'Containers','icon':'https://raw.githubusercontent.com/rhocode/rhocode.github.io/master/img/satoolsfactory_icons/Storage_Container_MK1.png','hidden':false,'id':6}}],'id':3,'x':0,'y':0,'overclock':100,'open_in_slots':1,'open_out_slot':1,'index':0,'vy':0,'vx':0}
      ],
    };

    graphData.nodes.forEach(elem => {
      elem.id = (id++);
    });

    const getter = id => {
      return graphData.nodes[id];
    };

    graphData.links = [
      {'source': getter(0), 'target': getter(1)},
    ];

    // this.createGraph(svg, graphData.nodes, graphData.links);
    const data = "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";
    this.loadGraphData(this.inflateGraphData(data));
  }

  render() {
    return <svg id="mainRender"/>;
  }
}

export default GraphSvg;