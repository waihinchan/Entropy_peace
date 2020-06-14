var roommsg = [];
var factoriesid = [];
var factories = [];//这个数组用于发送socket给服务器
// {pos:0,pol:1,pro:1}
var positions = [];//这里是用于存每个棋盘的位置，因为数量不多就直接写了
var poscount = 0;//这个用于记录的指针
var debug = false;
var GUIshow = false;//这个是点击事件 所有元素共享一个 试试行不行哈
var chance = 3; //这个逻辑有点麻烦 主要是类的销毁和所有别的奇奇怪怪的计算
//这个是UI表
const msgtables = {
  totalgold:{url:'',textContent:'1000 '+'gold current'}, //图片我还没加进去 url先留空
  pergold:{url:'',textContent:'0 '+'gold per sec'},
  perpollution:{url:'',textContent:'0 '+ 'per sec'},
  timeleft:{url:'',textContent:'10min'+' left'},//这里到时候要一个ejs模版
}
//这个是模型表
const models = {
  //这个url到时候要做一个请求 不能直接放在公用文件夹
  High_tech:    { url: '/model/Hightech.obj' , mtl_url: '/model/Hightech.mtl',name:'High_tech',pollution:2,production:2},
  Factory:  { url: '/model/Factory.obj' , mtl_url: '/model/Factory.mtl',name:'Factory',pollution:1,production:1},
  Ground:    { url: '/model/棋盘3.obj' , mtl_url: '/model/棋盘3.mtl',name:'Ground'},
  Purify: {url:'/model/Purify.obj',mtl_url:'/model/Purify.mtl',name:'Purify',pollution:-1,production:-1}
};
import * as THREE from '/three/build/three.module.js';
import * as OBJLoader from '/three/examples/jsm/loaders/OBJLoader.js';
import * as MTLLoader from '/three/examples/jsm/loaders/MTLLoader.js';
import  { CSS2DRenderer, CSS2DObject } from '/three/examples/jsm/renderers/CSS2DRenderer.js';
import { OrbitControls } from '/three/examples/jsm/controls/OrbitControls.js';

//初始设置 全局变量
var gamestart = false;//这个要等到socket信号 然后才允许玩家进行操作
const scene = new THREE.Scene();
if(debug){
  let axesHelper = new THREE.AxesHelper( 250 );
  scene.add( axesHelper );
}
const mycamera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
var raycaster = new THREE.Raycaster();//这个是射线 给我们的鼠标交互用的
var mouse = new THREE.Vector2();
const mygroup = new THREE.Group();//这个用来存建筑名 本来想改名字 但是只有一个组就算了 太麻烦了
const manager = new THREE.LoadingManager();
const myOBJLoader = new OBJLoader.OBJLoader(manager);//模型加载器
const myMTLLoader = new MTLLoader.MTLLoader(manager);//材质文件加载器
manager.onLoad = scene_init;
const renderer = new THREE.WebGLRenderer();
renderer.setSize(innerWidth, innerHeight);//设置渲染区域尺寸 //渲染尺寸或许可以不做那么大的
renderer.setClearColor(0xb9d3ff, 1); //设置背景颜色 //这个也可以改一下
document.body.appendChild(renderer.domElement); //这个尺寸有点问题 后面看看是不是用容器来渲
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize( window.innerWidth, window.innerHeight );
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
document.body.appendChild( labelRenderer.domElement );
var orbit = new OrbitControls( mycamera, labelRenderer.domElement );//这个迟早要删掉的
//初始设置 全局变量

var animate = function () {//这个是动画基本上没啥改的了（现阶段我草） //这里最好还是下次改一下 目前是简写
  requestAnimationFrame( animate );
  orbit.update();
  renderer.render( scene, mycamera );
  labelRenderer.render( scene, mycamera );
};
//运行程序 main藏在init里面了
loadmodel();
animate();
//运行程序 main藏在init里面了

//以下都是函数 不是直接调用的
//这个是加载中的动画效果
const progressbarElem = document.querySelector('#progressbar');
manager.onProgress = (url, itemsLoaded, itemsTotal) => {
  progressbarElem.style.width = `${itemsLoaded / itemsTotal * 100 | 0}%`;
};
//这个是加载中的动画效果
function scene_init() {
  // hide the loading bar
  const loadingElem = document.querySelector('#loading');
  loadingElem.style.display = 'none';//加载条样式后面记得要修改
  var myground = mygroup.getObjectByName ( "Ground" ); //地板不是工厂类
  myground.children[0].geometry.computeBoundingBox();//计算了我才知道它的长宽高
  if(debug){
    console.log(myground.children[0].geometry.boundingBox.max.z);
    console.log(myground.children[0].geometry.boundingBox.max.x);
  }
  let z = myground.children[0].geometry.boundingBox.max.z*2/3;//把x和z分量切成三分
  let x = myground.children[0].geometry.boundingBox.max.x*2/3;
  myground.position.set(myground.children[0].geometry.boundingBox.max.x,0,myground.children[0].geometry.boundingBox.max.z);
  scene.add(myground);
  for(let row = 0; row < 3; row ++){
    for(let col = 0; col < 3; col++){
      positions.push(new THREE.Vector3(x/2+x*row,0,z/2+z*col));
    };
  }
  if(debug){console.log('9个位置');console.log(positions);}
  mycamera.position.set(5,5,5); //相机视觉还需要修改 而且是不是可以把相机初始化放进来 现在因为有那个什么control不太方便
  mycamera.lookAt(0,0,0);
  scene.add(new THREE.AmbientLight(0x444444));//全局光直接给也不用改变量
  createGUI(models);
  GUI_interact();
}



function loadmodel(){
  for (const model of Object.values(models)) {
    myMTLLoader.load(model.mtl_url,function(materials){
      // console.log(model.name);
      console.log(materials);
      myOBJLoader.setMaterials(materials);
      myOBJLoader.load(model.url,function(obj){
        obj.name = model.name;
        obj.children[0].geometry.computeBoundingBox();
        obj.children[0].geometry.center();
        obj.position.set(0,obj.children[0].geometry.boundingBox.max.y,0);
        if(debug){
        var helper = new THREE.BoxHelper(obj);
        helper.update();
        scene.add(helper);}
        mygroup.add(obj);
        // scene.add(mygroup);
        console.log(obj);
      })
    })
  }
}


class Factory { 
  static delete_unit(myid) {
    if(debug){console.log('delete object id'+myid);}
    let deleteobject = scene.getObjectById(myid);
    deleteobject.children.forEach(child => {
      deleteobject.remove(child);//我也不知道为什么添加可以一起加 但是移除要先移除再加
    });
    scene.remove(deleteobject.children);
    //显示层面的删除了 这时候模型和标签消失了
    //模型要重新加载
    //但是标签要找到这个类 然后把这个类的这些属性重新赋予到新的模型上 同时还要发送数据 就很烦
    
  }
  constructor(position,pollution,production,model_name){
    this.model;
    this.ground_position = position; //这个是因为同名了 所以要改一个名字
    this.pollution = pollution;
    this.production = production;
    this.unique_id = null;//要等到加入到场景才知道。
    this.model_name = model_name;//这个因为我们的模型是加载好了直接给名字 而且我也不想搞什么拓展类 或者以后可以搞？
    this.label;
    this.factorylabel;
    this.control_btn;
    this.btn;
  }
  show(model_name){//show就是show 至于计算的东西 直接让房间计算就完事了 还有产出金币的问题用css渲染器把哦耶
    //这个部分是生成模型，还要生成一个标签和一个按钮。。 或者是动画？
    this.model = mygroup.getObjectByName(model_name).clone();//找名字 要用复制 而且组是不复制的 非常nice
    this.model.children[0].geometry.computeBoundingBox();//计算边界
    let modify = this.model.children[0].geometry.boundingBox.max.y;
    this.model.position.set(this.ground_position.x,this.ground_position.y+modify,this.ground_position.z);//这样应该就是浮在表面了
    this.unique_id = this.model.id;//这样就方便我删除了
  }
  addlabel(model){
        //这个部分是生成模型，还要生成一个标签悬浮和一个操作按钮 金币的浮现
        this.factorylabel = document.createElement('p');
        this.factorylabel.style.positions = 'absolute';
        this.factorylabel.textContent = `pol:${this.pollution} prod:${this.production}`;
        // factorylabel.style.display = 'none';//平时是不显示的 
        //这里的悬浮显示事件写在我们的3d鼠标射线事件中 不写在这里
        this.label = new CSS2DObject(this.factorylabel);
        this.label.visible = false;
        this.label.position.set(0,1,0);
        this.model.add(this.label);
        this.control_btn = document.createElement('button');
        this.control_btn.style.positions = 'absolute';
        this.control_btn.textContent = 'delete this factory';
        var tempid = this.unique_id;
        this.control_btn.addEventListener('click',function(){//event listener 连他妈个逼this都传递不进去
          Factory.delete_unit(tempid);
        });
        this.btn = new CSS2DObject(this.control_btn);
        this.btn.visible = false;
        this.btn.position.set(0,1.5,0);
        this.model.add(this.btn);
        scene.add(this.model);
  }
}
//GUI 生成还有一些处理表的过程 比如进房间的时候获取的一些数据 不过影响不大
function createGUI(models){
  //这个部分生成左面的控制按钮
  let building_menu = document.createElement('div');//做一个区块把这些东西搞起来吧
  building_menu.style.position = 'absolute'; //这里到时候改一个css样式来做 不要在这里写 因为这个是固定的
  for(const model of Object.values(models)){
    if(model.name!='Ground'){
      let building_button = document.createElement( 'BUTTON' );
      building_button.innerText = model.name;
      let br = document.createElement('br');
      building_menu.appendChild(building_button);
      building_menu.appendChild(br);
      //这个是功能
      building_button.addEventListener("click", function(){
        let temppos = positions[poscount];
        let new_factory = new Factory(temppos,model.pollution,model.production,model.name);
        if(debug){console.log(new_factory);}
        new_factory.show(new_factory.model_name);
        new_factory.addlabel(new_factory.model);
        factoriesid.push(poscount);//根据位置存index
        factories.push(new_factory);//存实体类（我为啥要用这么蠢的方法）
        poscount++;
      })
      //这个是功能
      //还有样式没有给
      console.log(model.name);
      //这个部分生成左面的控制按钮
    }
    let left_menu = new CSS2DObject( building_menu );
    // left_menu.position.set( 0,5,5);
    left_menu.position.set( -10,3,-10);
    mycamera.add(left_menu);
    // scene.add(mycamera);
  }
  //这个部分是顶部信息栏的
  let msg_menu = document.createElement('div');//顶部标签横向排列一下
  msg_menu.style.position = 'absolute';

  let idindex = 0;
  for(let msgtable of Object.values(msgtables)){
    let msg = document.createElement('p');
    msg.style.positions = 'absolute';
    msg.id = Object.getOwnPropertyNames(msgtables)[idindex];
    msg.innerText = msgtable.textContent;
    idindex++;
    //style 要设置一个间距的
    msg_menu.appendChild(msg);
    //这里的样式问题 需要在css里面搞一下 这里就不搞了
  }
  var top_menu = new CSS2DObject( msg_menu );
  top_menu.position.set(12,5,-10);
  mycamera.add(top_menu);
  // scene.add(mycamera);
  //这个部分是顶部信息栏的
  //这个部分是排行榜的
  var rank = document.createElement('div');
  rank.style.position = 'absolute';
  for(let i = 0; i < result.player_amount;i++){//这个result来自服务器渲染时给的人数
    var player = document.createElement('p');
    player.style.positions = 'absolute';
    player.id = `NO.${i}`;//排行第几个第几个 按道理应该是no1 但是我们是跟数组的 所以是0也没所谓
    if(i==0){
      player.textContent = `${result.player_id}:1000`;//这个也是暂时性的 但是游戏初始化的时候排在上面的就是自己
    }
    else{
      player.textContent = 'new player';//这里应该还有一个等待过程中 加入的时候获取的信息 到时候要写一个函数
    }
    rank.appendChild(player);
  }
  var rank_menu = new CSS2DObject( rank );
  
  rank_menu.position.set(-10,1,-10);
  mycamera.add(rank_menu);
  scene.add(mycamera);
}
//GUI的创建样式基本上就完成了 排行榜的参数传递还没弄其他的在看吧

//GUI 交互部分
function GUI_interact(){
  window.addEventListener( 'click', pick_unit, false );
  window.addEventListener( 'mousemove', hover_unit, false );
}
function hover_unit( event){//这个是移动鼠标事件
  if(!GUIshow){
    clearGUI();
    mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
    raycaster.setFromCamera( mouse, mycamera );// 当点击鼠标的时候 发射一条射线
    var intersects = raycaster.intersectObjects(scene.children,true);//然后获得这个数组
    if(intersects.length>0){
      //同样的检测对象 我不知道css2d和3d是否有mesh 如果有还是很麻烦 写一个规避一下把
      if(!(intersects[0].object.parent instanceof  CSS2DObject)){
        if(intersects[0].object.parent.name != 'Ground'){
          intersects[0].object.parent.children[1].visible = true; 
        }
      }
    }
    else{
      clearGUI();
    }
  }
}
function pick_unit( event ) {//这个是点击事件
  mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
  mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
  raycaster.setFromCamera( mouse, mycamera );// 当点击鼠标的时候 发射一条射线
  var intersects = raycaster.intersectObjects(scene.children,true);//然后获得这个数组
  if(debug){console.log('点击到的mesh'+intersects.length);}
  if(intersects.length>0){//这个是当你点击到东西的时候
    if(intersects[0].object.parent.name != 'Ground'){//只要不是ground
      clearGUI();//先清理，再show
      intersects[0].object.parent.children[1].visible = true;
      intersects[0].object.parent.children[2].visible = true;
      GUIshow = true;
    }
  }
  else{
    clearGUI();
    GUIshow=false;
  }
}
function clearGUI(){//dirty loop
    scene.children.forEach(child => {//这里返回的应该是每个group包括相机
      Object.getOwnPropertyNames(models).forEach(unitname => {//这里是遍历建筑列表 unitname是建筑的名字
        if(child.name == unitname){//如果这个单位是建筑
          child.children.forEach(csstag => {//这里看每个建筑下的对象归属哪个类
            if(csstag instanceof  CSS2DObject){//如果是css2dobject类的话
              csstag.visible = false;
            }
          });//foreach的东西 看着恶心
        }
      });//foreach的东西 看着恶心
    });

}
//GUI 交互部分
//以下都是函数 不是直接调用的  应该是
//目前GUI基本上解决了 所以接下来是要完善class类
//这里的class类是一个虚类 意思是实际上模型的显示并没有继承object3d（虽然我很想这么做 而且这么做有个好处是可以省很多代码）
//但是我的模型是clone来的 如果不用clone的话意味着每一次都要用loadingmanager 我觉得不是很稳定 如果服务器断了的话
//或者可以先请求模型的json下来 然后需要的时候再调用 但怎么都不怎么方便 我也不能改3js的object类吧哈哈哈
//还有一个是对类的继承不熟悉 应该是有一个原型继承或者修改构造器的方法的 这个改日再研究
//所以现在建筑创建了类就不会消失，因为如果是拆除建筑销毁类就太麻烦了
//所以拆除建筑的操作应该是：
//移除模型（css标签是跟着模型的）
//把单位污染和单位金币产出移除

//先做把单位移除的方法
1
//这个部分是模型矫正的 先不用 留着参考
// myMTLLoader.load('/model/Hightech.mtl', function(materials) {
//   // 返回一个包含材质的对象MaterialCreator
//   console.log(materials);
//   //obj的模型会和MaterialCreator包含的材质对应起来
//   myOBJLoader.setMaterials(materials);
//   myOBJLoader.load('/model/Hightech.obj', function(obj) {
//     obj.children[0].geometry.computeBoundingBox();//计算外边框 但是这个很明显是偏移了 所以我们直接用center
//     obj.children[0].geometry.center();//让它重新回到原点
//     obj.position.set(0,obj.children[0].geometry.boundingBox.max.y,0);//修正它回到原点
//     if(debug){
//     var helper = new THREE.BoxHelper(obj);//这里用于debug
//     helper.update();
//     scene.add(helper);}
//     scene.add(obj);//返回的组对象插入场景中
//   });
// });
// myMTLLoader.load('/model/棋盘3.mtl', function(materials) {
//   //这个是棋盘 这个定了之后基本上是不会变化的
//   //同时还有一个问题 要把棋盘的高度保留一下 以便让建筑都浮在棋盘上
//   console.log(materials);
//   //obj的模型会和MaterialCreator包含的材质对应起来
//   myOBJLoader.setMaterials(materials);
//   myOBJLoader.load('/model/棋盘3.obj', function(obj) {
//     obj.children[0].geometry.computeBoundingBox();//计算外边框 但是这个很明显是偏移了 所以我们直接用center
//     obj.children[0].geometry.center();//让它重新回到原点
//     obj.position.set(0,obj.children[0].geometry.boundingBox.max.y,0);//修正它回到原点
//     if(debug){
//     var helper = new THREE.BoxHelper(obj);
//     helper.update();
//     scene.add(helper);}
//     scene.add(obj);//返回的组对象插入场景中
//   });
// });

//这个部分先用于测试模型加载以及相机是否还正常运作
//试一下加载一些GUI在内部
// myMTLLoader.load('/model/ICON/Gold.mtl', function(materials) {
//   // 返回一个包含材质的对象MaterialCreator
//   console.log(materials);
//   //obj的模型会和MaterialCreator包含的材质对应起来
//   myOBJLoader.setMaterials(materials);
//   myOBJLoader.load('/model/ICON/Gold.obj', function(obj) {
//     console.log(obj);
//     obj.position.set(0,0,0);
//     // scene.add(obj);//返回的组对象插入场景中
//   });
// });
//这个部分是模型矫正的 先不用 留着参考