import * as THREE from '/three/build/three.module.js';
import * as OBJLoader from '/three/examples/jsm/loaders/OBJLoader.js';
import * as MTLLoader from '/three/examples/jsm/loaders/MTLLoader.js';
import * as GLTFLoader from '/three/examples/jsm/loaders/GLTFLoader.js';
import  { CSS2DRenderer, CSS2DObject } from '/three/examples/jsm/renderers/CSS2DRenderer.js';
import * as HDRCubeTextureLoader from '/three/examples/jsm/loaders/HDRCubeTextureLoader.js';
import { OrbitControls } from '/three/examples/jsm/controls/OrbitControls.js';

//初始设置 全局变量
var severmsg = {};
var factories = [];//这个数组存在roommsg里面
var positions = [];//这里是用于存每个棋盘的位置，因为数量不多就直接写了
var debug = false;
var GUIshow = false;//这个是点击事件 所有元label共享一个
var chance = 3; //3次拆除机会
var currentgold = 0; 
var TBC_gold = 0;
var unit_production = 0;
var unit_pollution = 0;
var gamestart = false;//这个要等到socket信号 然后才允许玩家进行操作
var gameover = false;

var bri = 3;
//这个是UI表
const msgtables = { //这个有个问题是归属的问题 但是的确是写在一起的 但是逻辑不是在一起的
  // totalgold:{url:'',textContent:'1000 '+'gold current',type:'p'}, //图片我还没加进去 url先留空
  pergold:{url:'',textContent:'0 '+'gold per sec',type:'p'},
  perpollution:{url:'',textContent:'0 '+ 'per sec',type:'p'},
  timeleft:{url:'',textContent:'10min'+' left',type:'p'},//这里到时候要一个ejs模版
  collectgold:{url:'',textContent:'collectmoney',type:'button',myfun:collect_money},//这里到时候要一个ejs模版
} 
// 这个是模型表
const models = {
  //这个url到时候要做一个请求 不能直接放在公用文件夹
  High_tech:    { url: '/model/hitech.obj' , mtl_url: '/model/hitech.mtl',name:'High_tech',pollution:2,production:2,cost:50,src:'/asset/hitech_icon.png'},
  Factory:  { url: '/model/factory.obj' , mtl_url: '/model/factory.mtl',name:'Factory',pollution:1,production:1,cost:20,src:'/asset/factory_icon.png'},
  Purify: {url:'/model/purify.obj',mtl_url:'/model/purify.mtl',name:'Purify',pollution:-1,production:-1,cost:5,src:'/asset/purify_icon.png'},
  Ground:    { url: '/model/棋盘3.obj' , mtl_url: '/model/棋盘3.mtl',name:'Ground',src:''}
};

const gltfmodels = { //这个如果很丑不想要后面就删屌
  Planet:{url : '/model/scene_ulti.gltf'}
}

const scene = new THREE.Scene();
//场景初始化
scene.background = 1;
//场景背景色
if(debug){
  let axesHelper = new THREE.AxesHelper( 250 );
  scene.add( axesHelper );
}
const mycamera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 5000 );
//相机
var listener = new THREE.AudioListener();
var sound = new THREE.Audio( listener );
//音乐 后面把它删掉 为了保证没有bug
var raycaster = new THREE.Raycaster();
//这个是射线 给我们的鼠标交互用的
var mouse = new THREE.Vector2();
var mygroup = new THREE.Group();
//这个用来存建筑名 本来想改名字 但是只有一个组就算了 太麻烦了
var atm_light = new THREE.DirectionalLight( 0xF5F5F5,5);
//这个是游戏结束时的灯
const manager = new THREE.LoadingManager();
const myOBJLoader = new OBJLoader.OBJLoader(manager);//模型加载器
const myMTLLoader = new MTLLoader.MTLLoader(manager);//材质文件加载器
const progressbarElem = document.querySelector('#progressbar');
manager.onProgress = (url, itemsLoaded, itemsTotal) => {
  progressbarElem.style.width = `${itemsLoaded / itemsTotal * 100 | 0}%`;
};
//这个应该是loading界面的条 运行的没啥毛病不管了

manager.onLoad = scene_init;
// ********************************** //
const renderer = new THREE.WebGLRenderer();
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0xAAAAAA, 1); //设置背景颜色
document.body.appendChild(renderer.domElement); //这个尺寸有点问题 后面看看是不是用容器来渲
//设置渲染区域尺寸.这个是一个问题..如果解决了canvas的问题可能就不需要搞这么多复杂的东西了
// ********************************** //

const labelRenderer = new CSS2DRenderer();
//这个是GUI的渲染器
labelRenderer.setSize( window.innerWidth, window.innerHeight );
//这里设置了全屏幕的有点迷啊

labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
//这个部分可以DEBUG试试要看看

document.body.appendChild( labelRenderer.domElement );
var orbit = new OrbitControls( mycamera, labelRenderer.domElement );
loadmodel();//load model 可以先进行
//初始设置 全局变量

var animate = function () {
  requestAnimationFrame( animate );
  orbit.update();
  // var Planet = scene.getObjectByName('Scene').getObjectByName('快乐星球最终版gltf');
  // Planet.rotation.y += 0.001;
  renderer.render( scene, mycamera );
  labelRenderer.render( scene, mycamera );
  if(gameover){
    atm_light.intensity-=0.05;
  }
};
//运行程序 main藏在init里面了



//通讯
// const socket = io.connect('http://localhost:3000');
// const socket = io.connect(`https://entropypeace.herokuapp.com:${process.env.PORT}`||'http://localhost:3000');
const socket = io.connect(`https://entropypeace.herokuapp.com`||'http://localhost:3000');

socket.on('connect',function(){//这个是当你初始链接后马上返回的信息 同时让玩家加入
  console.log('connected to the sever');
  result.unique_id = socket.id; //这个是玩家唯一的ID
  send_room_req(result); //这个result是ejs里面给的..这么写有点傻逼以后改一下
  console.log(result);
});


socket.on('update_room_status',function(data){//这个是游戏运行中的房间信息
  severmsg = null;
  severmsg = JSON.parse(JSON.stringify(data));//把来自服务器的信息修改一下
  if(debug){
    console.log('接收到了');
    console.log(data);
    console.log('处理后的新消息');
    console.log(severmsg);  
  }

});

socket.on('gamestatus',function(data){
  //这个是游戏的房间状态 比如说开始 新人加入 游戏结束 等等
  console.log(data);
  if(data.game_status == 'start'){//也可以用once来写 但是这样还不如直接这么写
    console.log('game start after 3s');

    var countdown = document.createElement('p');
    var daojishi = new CSS2DObject(countdown);
    countdown.textContent = '3';
    countdown.style.pollution = 'absolute';
    daojishi.position.set(0,3,-10);
    mycamera.add(daojishi);
    var timeleft = 3;
    var tempcd = setInterval(function(){
      timeleft--;
      countdown.textContent = timeleft;
    }, 1000);
    setTimeout(() => {//接收到gamestart之后 三秒后可以开始操作
      clearInterval(tempcd);//不用在计数了
      gamestart = true; //游戏开始的状态看看后面会影响什么
      GUI_interact(); //这个是GUI可以开始交互了
      currentgold = data.moneyrank[0].money;//这个现有金钱是来自于服务器给的 一开始大家都一样是直接从某一位数取
      gen_money();//这个是计算金钱的函数
      mycamera.remove(daojishi);//remove应该也没有问题 反正就不会显示了
      sound.play();//这个音乐如果不同步就tm不播放了
    }, 3000);
    //这个是游戏开始倒计时的GUI 不写成函数了 这样也很直观
  }
  else if(data.game_status == 'all lose!'){
    //这里需要加一些提示界面 同时让requestframe变暗 同时还要处理一个排序的问题
    updateGUI();
    gameover = true; //这里还要发送结束的东西
    // 这个部分我先关掉了...
    // var bg = document.createElement('div');
    // bg.id = 'bg';
    // bg.style.backgroundColor = 'black';
    // var alllose = document.createElement('p');
    // bg.appendChild(alllose);
    // alllose.textContent = 'These violent delights have violent ends';
    // alllose.style.fontSize = '50px';
    // alllose.style.color = 'rgb(255, 255,255)';
    // var endmsg = new CSS2DObject(bg);
    // endmsg.position.set(0,2,-10);
    // mycamera.add(endmsg);
    // 这个部分我先关掉了...
  }
  else{
    updateGUI();
    gameover = true; //这里还要发送结束的东西
    var bg = document.createElement('div');
    bg.id = 'bg';
    bg.style.backgroundColor = 'black';
    var alllose = document.createElement('p');
    bg.appendChild(alllose);
    alllose.textContent = `${JSON.stringify(data.moneyrank)}`;
    alllose.style.fontSize = '10px';
    alllose.style.color = 'rgb(255, 255,255)';
    var endmsg = new CSS2DObject(bg);
    endmsg.position.set(0,2,-10);
    mycamera.add(endmsg);
  }
  
  console.log('now this room is '+ data.game_status);
});

function send_room_req(init_room_message){//这个函数是在连接到socketio之后马上把房间号信息发送到服务器
  socket.emit('room_req',init_room_message);
}

//通讯

//运行程序 main藏在init里面了

//以下都是函数 不是直接调用的
//这个是加载中的动画效果

//这个是加载中的动画效果
function scene_init() {
  // hide the loading bar
  const loadingElem = document.querySelector('#loading');
  loadingElem.style.display = 'none';
  //地板
  var myground = mygroup.getObjectByName ( "Ground" ); //地板不是工厂类
  myground.children[0].geometry.computeBoundingBox();//计算了我才知道它的长宽高
  if(debug){
    console.log(myground.children[0].geometry.boundingBox.max.z);
    console.log(myground.children[0].geometry.boundingBox.max.x);
  }
  let z = myground.children[0].geometry.boundingBox.max.z*2/3;//把x和z分量切成三分
  let x = myground.children[0].geometry.boundingBox.max.x*2/3;
  // myground.position.set(myground.children[0].geometry.boundingBox.max.x,0,myground.children[0].geometry.boundingBox.max.z);
  // scene.add(myground);
  //地板
  //这里因为需要计算位置所以没啥办法
  for(let row = 0; row < 3; row ++){
    for(let col = 0; col < 3; col++){
      positions.push(new THREE.Vector3(x/2+x*row,0,z/2+z*col));
    };
  }
  //这里因为需要计算位置所以没啥办法
  if(debug){console.log('9个位置');console.log(positions);}
  mycamera.position.set(-5,2,10); //相机视觉还需要修改 而且是不是可以把相机初始化放进来 现在因为有那个什么control不太方便
  mycamera.lookAt(4,0,4);
  // scene.add(new THREE.AmbientLight(0xffffff));
  
  scene.add( atm_light);
  // scene.add( new THREE.HemisphereLight( ) );//这几个区别不是很大.
  createGUI(models);
  //sound
  
  mycamera.add( listener );
  // create a global audio source
  var audioLoader = new THREE.AudioLoader();
  audioLoader.load( '/asset/bgm.mp3', function( buffer ) {
    sound.setBuffer( buffer );
    sound.setLoop( false );
    sound.setVolume( 0.5 );
    
  });
 //sound
  animate();
  
  
}
// 现有的bug是..给模型给太慢了 没有回调 按道理服务器应该等所有人载入完毕后再发送游戏开始指令
// 这也是经验吧但是以后也用不上

class Factory extends THREE.Object3D{ //继承obj3d类
  static delete_unit(myid,self,emptypos) { //类静态方法
    if(chance>0){
      if(debug){console.log('delete object id'+myid);}
      chance--;
      let deleteobject = scene.getObjectById(myid);
      deleteobject.children.forEach(child => {
        deleteobject.remove(child);//我也不知道为什么添加可以一起加 但是移除要先移除再加
      });
      scene.remove(deleteobject.children);
      positions.push(emptypos);
      // delete factories;
      //显示层面的删除了 这时候模型和标签消失了
      //模型要重新加载
      //但是标签要找到这个类 然后把这个类的这些属性重新赋予到新的模型上 同时还要发送数据 就很烦
      let tempindex = factories.indexOf(self);
      factories.splice(tempindex);
      
      
      if(debug){
        console.log(factories);
      }
    }
  }
  constructor(position,pollution,production,model_name){
    super();
    
    this.ground_position = position; //这个是因为同名了 所以要改一个名字
    this.pollution = pollution;
    this.production = production;
    this.model_name = model_name;//这个因为我们的模型是加载好了直接给名字 而且我也不想搞什么拓展类 或者以后可以搞？
    this.label;
    this.factorylabel;
    this.control_btn;
    this.btn;
  }

  show(){
    this.copy(mygroup.getObjectByName(this.model_name));
    this.children[0].geometry.computeBoundingBox();//计算边界
    let modify = this.children[0].geometry.boundingBox.max.y;
    this.position.set(this.ground_position.x,this.ground_position.y+modify,this.ground_position.z);
    this.addlabel();
    //聚光灯
    // var alight = new THREE.PointLight( 0x444444, 1, 100 );
    // alight.position.set(0,10,0);
    // alight.lookAt(this.position);
    // this.add(alight);
    //聚光灯
    scene.add(this);
  }
  addlabel(){
        //这个部分是生成模型，还要生成一个标签悬浮和一个操作按钮 金币的浮现
        this.factorylabel = document.createElement('p');
        this.factorylabel.textContent = `polluton: ${this.pollution} production :${this.production}`;
        // factorylabel.style.display = 'none';//平时是不显示的 
        //这里的悬浮显示事件写在我们的3d鼠标射线事件中 不写在这里
        this.label = new CSS2DObject(this.factorylabel);
        this.label.visible = false;
        this.label.position.set(0,2,0);
        this.add(this.label);
        this.control_btn = document.createElement('button');
        this.control_btn.style.positions = 'absolute';
        this.control_btn.textContent = `delete this ${this.name}`;
        var tempid = this.id;
        var self = this;
        var emptypos = this.ground_position;
        this.control_btn.addEventListener('click',function(){//event listener 连他妈个逼this都传递不进去
          Factory.delete_unit(tempid,self,emptypos);
          send_room_msg(caculate_room_msg());
        });
        this.btn = new CSS2DObject(this.control_btn);
        this.btn.visible = false;
        this.btn.position.set(0,2.5,0);
        this.add(this.btn);
        
  }

}

//GUI 生成还有一些处理表的过程 比如进房间的时候获取的一些数据 不过影响不大

function add_new_factory(model){ //这个用于启动新房间
    if(gamestart&&!gameover){
      if(currentgold>=model.cost){
          if(positions.length>0){
          let temppos = positions.shift();
          let new_factory = new Factory(temppos,model.pollution,model.production,model.name); 
          new_factory.show();
          if(debug){console.log(new_factory);}
          factories.push(new_factory);
          currentgold-=model.cost;
          send_room_msg(caculate_room_msg());
        }
      }
    }
  }
function createGUI(models){//用模型列表来生成gui 这个逻辑其实还是要改的 最好把所有gui都合并
  //这个部分生成左面的控制按钮
  let building_menu = document.createElement('div');
  building_menu.id = 'building_menu';
  for(const model of Object.values(models)){
    if(model.name!='Ground'){
      let sourcenode = document.getElementById('for_clone');
      let clonenode = sourcenode.cloneNode(true);
      clonenode.style.display = 'inline';
      let unit_name = clonenode.querySelector('#unit_name');
      unit_name.textContent = model.name;
      unit_name.style.textAlign = 'center';
      let model_img = clonenode.querySelector('#model_img');
      model_img.src = model.src;
      let money = clonenode.querySelector('#money');
      money.innerHTML = `<img src="/asset/co2_icon.png" width="20" height="20"/> money: ${model.production}`;
      let co2 = clonenode.querySelector('#co2');
      co2.innerHTML = `<img src="/asset/money_icon.png" width="20" height="20"/> co2: ${model.pollution}`;
      let price = clonenode.querySelector('#price');
      price.innerHTML = `price: ${model.cost} <button>create</button>`;
      let building_button = clonenode.querySelector("button");
      building_menu.appendChild(clonenode);
      building_button.addEventListener("click", function(){
        add_new_factory(model);
      })

      //这个部分生成左面的控制按钮
    }
    let left_menu = new CSS2DObject( building_menu );
    
    // left_menu.position.set( 0,5,5);
    left_menu.position.set( -10,0,-10);
    mycamera.add(left_menu);
    // scene.add(mycamera);
  }
  //这个部分是顶部信息栏的
  let msg_menu = document.createElement('div');//顶部标签横向排列一下
  msg_menu.style.position = 'absolute';

  let idindex = 0;
  for(const msgtable of Object.values(msgtables)){
    let msg = document.createElement(msgtable.type);
    msg.style.positions = 'absolute';
    msg.id = Object.getOwnPropertyNames(msgtables)[idindex];
    msg.innerText = msgtable.textContent;
    if(msgtable.myfun!=null){
      msg.addEventListener('click',msgtable.myfun);
    }
    idindex++;
    //style 要设置一个间距的
    msg_menu.appendChild(msg);
    //这里的样式问题 需要在css里面搞一下 这里就不搞了
  }
  var top_menu = new CSS2DObject( msg_menu );
  top_menu.position.set(10,5,-10);//位置暂时放在了右侧
  mycamera.add(top_menu);
  // scene.add(mycamera);
  //这个部分是顶部信息栏的
  //这个部分是排行榜的
  var rank = document.createElement('div');
  rank.style.position = 'absolute';
  for(let i = 0; i < result.player_amount;i++){//这个result来自服务器渲染时给的人数
    var player = document.createElement('p');
    player.id = `NO.${i}`;//排行第几个第几个 按道理应该是no1 但是我们是跟数组的 所以是0也没所谓
    if(i==0){
      player.textContent = 'you';//这个也是暂时性的 但是游戏初始化的时候排在上面的就是自己
    }
    else{
      player.textContent = 'TBD:';//这里应该还有一个等待过程中 加入的时候获取的信息 到时候要写一个函数
    }
    rank.appendChild(player);
  }
  var rank_menu = new CSS2DObject( rank );
  rank_menu.position.set(10,1,-10); 
  mycamera.add(rank_menu);
  var total_hp = document.createElement('div');
  total_hp.id = 'total_hp_bar';
  var hpvalue = document.createElement('p');//这里最好把内容独立出来 主要是宽度会受到影响 比如说在上面再嵌套一个
  hpvalue.id = 'hp';
  hpvalue.textContent = ' hp left';
  total_hp.appendChild(hpvalue);
  var total_hp_bar = new CSS2DObject(total_hp);
  total_hp_bar.position.set(0,6,-10);
  mycamera.add(total_hp_bar);
  scene.add(mycamera);
}
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
      if((intersects[0].object.parent instanceof  Factory)){
          intersects[0].object.parent.label.visible = true;
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
    if((intersects[0].object.parent instanceof  Factory)){
      clearGUI();//先清理，再show
      if(chance>0){
      intersects[0].object.parent.label.visible = true;
      intersects[0].object.parent.btn.visible = true;
    }
    else{
      intersects[0].object.parent.label.visible = true;
    }
      GUIshow = true;
    }
  }
  else{
    clearGUI();
    GUIshow=false;
  }
}
function clearGUI(){
    scene.children.forEach(child => {
      if(child instanceof  Factory){
        child.label.visible = false;
        child.btn.visible = false;
      }
    });
}
//这个发送房间信息的思路可以通过写一个eventemitter触发 比如说每次监测到数字的变化 
//就把信息发出去 这样可以省掉很多写的步骤 维护也更方便 后面改一下
function send_room_msg(roommsg){//每次发送都是发送这些
// {room_id: 'xxx',player_id : 'xxx',money:'100',factory:[0,1,2,3,4],unique_id:'xasdkfenn'}
if(!gameover){
  socket.emit('msg_from_client',roommsg);
}
  
}
function caculate_room_msg(){//建筑变化产生了单位污染和单位产出的变化所以只计算这两个环节
  var pollution_list = [];
  unit_pollution = 0;
  unit_production = 0;
  factories.forEach(factory => {
    pollution_list.push(factory.pollution);
    unit_pollution+=factory.pollution;
    unit_production+=(factory.production);
  });
  
  updateGUI();
  var roommsg = {};
  roommsg = {room_id:result.room_id, player_id :result.player_id, money:currentgold, factory:pollution_list, unique_id:result.unique_id} //uniqueid先留空 后端服务器没把这个传递过来
  console.log(roommsg);
  
  return roommsg;
} 
function gen_money(){
  setInterval(() => {
    TBC_gold+=unit_production;
    if(TBC_gold<0){
      collect_money();
    }
    updateGUI();
  }, 1000);
  
}
function collect_money(){//这个是一个按钮 按下去就可以收集金币 这个部分是放着creategui的
  currentgold+=TBC_gold;
  TBC_gold = 0;
  send_room_msg(caculate_room_msg());
}
function updateGUI(){
  //这个迟早要优化的 目前还有一个创建gui房间人数不一致导致多生成了标签的问题 等待到房间号加入后更新人数这个时候再改bug
  if(severmsg.hp>=0||severmsg.time_left>0){

  var msg_pergold = document.getElementById('pergold');
  var msg_collectgold = document.getElementById('collectgold');
  var msg_perpollution = document.getElementById('perpollution');
  if(msg_perpollution != null){
    msg_perpollution.textContent = `${unit_pollution} pollution per sec`;

  }
  if(msg_pergold != null){
    msg_pergold.textContent = `${unit_production} production per sec`;
  }
  if(msg_collectgold != null){
    msg_collectgold.textContent = `collect${TBC_gold} gold`;
  }
  
  for(let i = 0; i < severmsg.moneyrank.length;i++){
    
    var thisplayer = document.getElementById(`NO.${i}`);//先找到这个元素
    if(thisplayer!=null){
      if(severmsg.moneyrank[i].unique_id==result.unique_id){
        thisplayer.textContent = `you: ${severmsg.moneyrank[i].money}`;
      }
      else{
        thisplayer.textContent = `${severmsg.moneyrank[i].player_name}: ${severmsg.moneyrank[i].money}`;
      }
    }
  }
  var lefthp = document.getElementById('hp');
  lefthp.textContent =`${severmsg.hp}/ 100 hp left`;  //这个后面是要改的
  lefthp.style.textAlign = 'center';
  var hpbar = document.getElementById('total_hp_bar');
  hpbar.style.width = `${(severmsg.hp / severmsg.hp * 100 | 0)*0.5}%`;
  var time_left = document.getElementById('timeleft');
  time_left.textContent = `${severmsg.time_left/1000} sec left` ;

}

}




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
// var hdrCubeMap;
// hdrCubeMap = new HDRCubeTextureLoader()
// 					.setPath( '/model/C017.hdr' )
// 					.setDataType( THREE.UnsignedByteType )
// 					.load( hdrUrls, function () {

// 						hdrCubeRenderTarget = pmremGenerator.fromCubemap( hdrCubeMap );

// 						hdrCubeMap.magFilter = THREE.LinearFilter;
// 						hdrCubeMap.needsUpdate = true;

// 					} );





// ************* 这个部分不用看了 ************* //
function loadmodel(){
  for (const model of Object.values(models)) {
    //这个写法不太好 有些异步加载的问题
    // myMTLLoader.load(model.mtl_url,function(materials){
    //   var thismaterials = materials;
    //   myOBJLoader.setMaterials(thismaterials);
    //   myOBJLoader.load(model.url,function(obj){
    //     obj.name = model.name;
    //     obj.children[0].geometry.computeBoundingBox();
    //     obj.children[0].geometry.center();
    //     obj.position.set(0,obj.children[0].geometry.boundingBox.max.y,0);
    //     if(debug){
    //     var helper = new THREE.BoxHelper(obj);
    //     helper.update();
    //     scene.add(helper);}
    //     mygroup.add(obj);
    //     // scene.add(mygroup);
    //     console.log(obj);
    //   })
    // })
    //这个写法不太好
    new MTLLoader.MTLLoader( manager )
    .load( model.mtl_url, function ( materials ) {
      console.log(materials);
      materials.preload();

      new OBJLoader.OBJLoader( manager )
        .setMaterials( materials )
        .load( model.url, function ( obj ) {
        console.log(obj);
        obj.name = model.name;
        obj.children[0].geometry.computeBoundingBox();
        obj.children[0].geometry.center();
        obj.position.set(0,obj.children[0].geometry.boundingBox.max.y,0);
        mygroup.add(obj);
        // scene.add(obj);
        });

    } );
  }
  // ************ 这里把scene换了就是了
  for (const gltfmodel of Object.values(gltfmodels)) {//这里可能要一个一个加载?
    new GLTFLoader.GLTFLoader(manager)
    .load(gltfmodel.url,function(gltf){
      scene.add( gltf.scene );
      console.log(scene);
      
    });
  }
  // ************ 这里把scene换了就是了
}
// ************* 这个部分不用看了 ************* //