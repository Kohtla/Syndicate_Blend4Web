"use strict"

// register the application module

b4w.register("Syndicate_main", function(exports, require) {


var m_anim 		= require("animation");
var m_cons 		= require("constraints");
var m_quat 		= require("quat");
var m_vec3 		= require("vec3");
var m_cam       = require("camera");
var m_ctl       = require("controls");
var m_math      = require("math");
var m_obj       = require("objects");
var m_phy       = require("physics");
var m_version   = require("version");
var m_app       = require("app");
var m_cfg       = require("config");
var m_data      = require("data");
var m_preloader = require("preloader");
var m_ver       = require("version");
var m_mouse     = require("mouse");
var m_scenes    = require("scenes");
var m_trans     = require("transform");
var m_cont      = require("container");
var m_tsr       = require("tsr");
var m_util 		=require("util");
	
	
	
var _selected_obj = null;
var OUTLINE_COLOR_VALID = [0, 1, 0];
var OUTLINE_COLOR_ERROR = [1, 0, 0];
var FLOOR_PLANE_NORMAL = [0, 0, 1];
	

	
var _obj_delta_xy = new Float32Array(2);
var spawner_pos = new Float32Array(3);
var _vec3_tmp = new Float32Array(3); 
var _vec3_tmp2 = new Float32Array(3);
var _vec3_tmp3 = new Float32Array(3);
var _vec4_tmp = new Float32Array(4);
var _pline_tmp = m_math.create_pline();
	

var decal_src = null;
	


var _drag_mode = false;
var _enable_camera_controls = true;



var DEBUG = (m_version.type() === "DEBUG");

var APP_ASSETS_PATH = m_cfg.get_assets_path("Syndicate");

exports.init = function() {
    m_app.init({
        autoresize: true,
        callback: init_cb,
        canvas_container_id: "main_canvas_container",
        physics_enabled: true,
        show_fps: true,
        assets_dds_available: !DEBUG,
        assets_min50_available: !DEBUG,
        console_verbose: true
    });
}

function init_cb(canvas_elem, success) {

    if (!success) {
        console.log("b4w init failure");
        return;
    }
    load();
}

function load() {
    m_data.load(APP_ASSETS_PATH + "Syndicate.json", load_cb, null);
}

function load_cb(data_id) {
    init_logic();
	init_controls();
	m_app.enable_camera_controls();
}
	
function preloader_cb(percentage) {
    m_preloader.update_preloader(percentage);
}

function loaded_cb(data_id) {

    var objs = m_scenes.get_all_objects("ALL", data_id);
    for (var i = 0; i < objs.length; i++) {
        var obj = objs[i];

        if (m_phy.has_physics(obj)) {
            m_phy.enable_simulation(obj);

            // create sensors to detect collisions
            var sensor_col = m_ctl.create_collision_sensor(obj, "Details");
            var sensor_sel = m_ctl.create_selection_sensor(obj, true);

            if (obj == _selected_obj)
                m_ctl.set_custom_sensor(sensor_sel, 1);

            m_ctl.create_sensor_manifold(obj, "COLLISION", m_ctl.CT_CONTINUOUS, 
                    [sensor_col, sensor_sel], logic_func, trigger_outline);


            // spawn appended object at a certain position
            var obj_parent = m_obj.get_parent(obj);
            if (obj_parent && m_obj.is_armature(obj_parent))
                // translate the parent (armature) of the animated object
                m_trans.set_translation_v(obj_parent, spawner_pos);
            else
                m_trans.set_translation_v(obj, spawner_pos);
        }

        // show appended object
        if (m_obj.is_mesh(obj))
            m_scenes.show_object(obj);
    }
}

function logic_func(s) {
    return s[1];
}

	
function trigger_outline(obj, id, pulse) {
    if (pulse == 1) {
        // change outline color according to the  
        // first manifold sensor (collision sensor) status
        var has_collision = m_ctl.get_sensor_value(obj, id, 0);
        if (has_collision)
            m_scenes.set_outline_color(OUTLINE_COLOR_ERROR);
        else
            m_scenes.set_outline_color(OUTLINE_COLOR_VALID);
    }
}
	
function init_controls(){
	    var controls_elem = document.getElementById("controls-container");
    controls_elem.style.display = "block";

    init_buttons();
	console.log("Init_controls");

    document.getElementById("load-1").addEventListener("click", function(e) {
        m_data.load(APP_ASSETS_PATH + "Pocket.json", loaded_cb, null, null, true);
    });
    document.getElementById("load-2").addEventListener("click", function(e) {
        m_data.load(APP_ASSETS_PATH + "Button.json", loaded_cb, null, null, true);
    });
	
	document.getElementById("delete").addEventListener("click", function(e) {
        if (_selected_obj) {
            var id = m_scenes.get_object_data_id(_selected_obj);
            m_data.unload(id);
            _selected_obj = null;
        }
    });
	
}
	

function init_buttons() {
    var ids = ["delete"];

    for (var i = 0; i < ids.length; i++) {
        var id = ids[i];

        document.getElementById(id).addEventListener("mousedown", function(e) {
            var parent = e.target.parentNode;
            parent.classList.add("active");
        });
        document.getElementById(id).addEventListener("mouseup", function(e) {
            var parent = e.target.parentNode;
            parent.classList.remove("active");
        });
        document.getElementById(id).addEventListener("touchstart", function(e) {
            var parent = e.target.parentNode;
            parent.classList.add("active");
        });
        document.getElementById(id).addEventListener("touchend", function(e) {
            var parent = e.target.parentNode;
            parent.classList.remove("active");
        });
    }
}	
function init_logic() {

    var from = new Float32Array(3);
    var pline = m_math.create_pline();
    var to = new Float32Array(3);
	
    var decal_num = 0;	
   
	var flag = false;

    var decal_tsr = m_tsr.create();
    var obj_tsr = m_tsr.create();
    var decal_rot = m_quat.create();

    var ray_test_cb = function(id, hit_fract, obj_hit, hit_time, hit_pos, hit_norm) {
		
        //var decal = m_obj.copy(decal_src, "decal" + String(++decal_num), false);
        //m_scenes.append_object(decal);

        m_tsr.set_trans(hit_pos, decal_tsr);

        m_quat.rotationTo(m_util.AXIS_Z, hit_norm, decal_rot);
        m_trans.set_rotation_v(decal_src, decal_rot);
        m_tsr.set_quat(decal_rot, decal_tsr);

        if (obj_hit && m_anim.is_animated(obj_hit)) {
            m_trans.get_tsr(obj_hit, obj_tsr);

            m_tsr.invert(obj_tsr, obj_tsr);
            m_tsr.multiply(obj_tsr, decal_tsr, decal_tsr);

            var offset = m_tsr.get_trans_view(decal_tsr);
            var rot_offset = m_tsr.get_quat_view(decal_tsr);
            m_cons.append_stiff(decal_src, obj_hit, offset, rot_offset);
        }

        m_trans.set_tsr(decal_src, decal_tsr);
    }

    var mouse_cb = function(e) {
		if(decal_src)
		   {
			   var x = e.clientX;
			   var y = e.clientY;
			   m_app.enable_camera_controls();
		
		/*var objs = m_scenes.get_all_objects("ALL");
    	for (var i = 0; i < objs.length; i++) 
		{
      	  	var obj = objs[i];
			console.log(obj);
		}*/
		
		//console.log(decal_src);
			   m_cam.calc_ray(m_scenes.get_active_camera(), x, y, pline);
			   m_math.get_pline_directional_vec(pline, to);
			   console.log(decal_src);
			   m_vec3.scale(to, 100, to);
			   var obj_src = m_scenes.get_active_camera();
			   var id = m_phy.append_ray_test_ext(obj_src, from, to, "ANY", ray_test_cb, true, false, true, true);
		   	
		   }
        
    }
	
	var mouse_down_cb=function(e)
	{
		
		var x = e.clientX;
        var y = e.clientY;
		decal_src = m_scenes.pick_object(x,y);
		flag = true;
		if(decal_src)
			{
				m_app.disable_camera_controls();
			}
		console.log(decal_src);
		console.log(flag);
	}
	
	var mouse_up_cb =function(e)
	{
		decal_src = null;
	}
	
    var cont = m_cont.get_container();
	
			cont.addEventListener("mousedown",mouse_down_cb,false);
		
	
			cont.addEventListener("mouseup", mouse_up_cb, false);
			
			cont.addEventListener("mousemove", mouse_cb, false);
	
	
    
}
	});

// import the app module and start the app by calling the init method
b4w.require("Syndicate_main").init();
