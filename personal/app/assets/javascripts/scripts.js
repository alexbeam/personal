// jquery.event.move
//
// 1.3.6
//
// Stephen Band
//
// Triggers 'movestart', 'move' and 'moveend' events after
// mousemoves following a mousedown cross a distance threshold,
// similar to the native 'dragstart', 'drag' and 'dragend' events.
// Move events are throttled to animation frames. Move event objects
// have the properties:
//
// pageX:
// pageY:   Page coordinates of pointer.
// startX:
// startY:  Page coordinates of pointer at movestart.
// distX:
// distY:  Distance the pointer has moved since movestart.
// deltaX:
// deltaY:  Distance the finger has moved since last event.
// velocityX:
// velocityY:  Average velocity over last few events.


(function (module) {
	if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define(['jquery'], module);
	} else {
		// Browser globals
		module(jQuery);
	}
})(function(jQuery, undefined){

	var // Number of pixels a pressed pointer travels before movestart
	    // event is fired.
	    threshold = 6,
	
	    add = jQuery.event.add,
	
	    remove = jQuery.event.remove,

	    // Just sugar, so we can have arguments in the same order as
	    // add and remove.
	    trigger = function(node, type, data) {
	    	jQuery.event.trigger(type, data, node);
	    },

	    // Shim for requestAnimationFrame, falling back to timer. See:
	    // see http://paulirish.com/2011/requestanimationframe-for-smart-animating/
	    requestFrame = (function(){
	    	return (
	    		window.requestAnimationFrame ||
	    		window.webkitRequestAnimationFrame ||
	    		window.mozRequestAnimationFrame ||
	    		window.oRequestAnimationFrame ||
	    		window.msRequestAnimationFrame ||
	    		function(fn, element){
	    			return window.setTimeout(function(){
	    				fn();
	    			}, 25);
	    		}
	    	);
	    })(),
	    
	    ignoreTags = {
	    	textarea: true,
	    	input: true,
	    	select: true,
	    	button: true
	    },
	    
	    mouseevents = {
	    	move: 'mousemove',
	    	cancel: 'mouseup dragstart',
	    	end: 'mouseup'
	    },
	    
	    touchevents = {
	    	move: 'touchmove',
	    	cancel: 'touchend',
	    	end: 'touchend'
	    };


	// Constructors
	
	function Timer(fn){
		var callback = fn,
		    active = false,
		    running = false;
		
		function trigger(time) {
			if (active){
				callback();
				requestFrame(trigger);
				running = true;
				active = false;
			}
			else {
				running = false;
			}
		}
		
		this.kick = function(fn) {
			active = true;
			if (!running) { trigger(); }
		};
		
		this.end = function(fn) {
			var cb = callback;
			
			if (!fn) { return; }
			
			// If the timer is not running, simply call the end callback.
			if (!running) {
				fn();
			}
			// If the timer is running, and has been kicked lately, then
			// queue up the current callback and the end callback, otherwise
			// just the end callback.
			else {
				callback = active ?
					function(){ cb(); fn(); } : 
					fn ;
				
				active = true;
			}
		};
	}


	// Functions
	
	function returnTrue() {
		return true;
	}
	
	function returnFalse() {
		return false;
	}
	
	function preventDefault(e) {
		e.preventDefault();
	}
	
	function preventIgnoreTags(e) {
		// Don't prevent interaction with form elements.
		if (ignoreTags[ e.target.tagName.toLowerCase() ]) { return; }
		
		e.preventDefault();
	}

	function isLeftButton(e) {
		// Ignore mousedowns on any button other than the left (or primary)
		// mouse button, or when a modifier key is pressed.
		return (e.which === 1 && !e.ctrlKey && !e.altKey);
	}

	function identifiedTouch(touchList, id) {
		var i, l;

		if (touchList.identifiedTouch) {
			return touchList.identifiedTouch(id);
		}
		
		// touchList.identifiedTouch() does not exist in
		// webkit yet… we must do the search ourselves...
		
		i = -1;
		l = touchList.length;
		
		while (++i < l) {
			if (touchList[i].identifier === id) {
				return touchList[i];
			}
		}
	}

	function changedTouch(e, event) {
		var touch = identifiedTouch(e.changedTouches, event.identifier);

		// This isn't the touch you're looking for.
		if (!touch) { return; }

		// Chrome Android (at least) includes touches that have not
		// changed in e.changedTouches. That's a bit annoying. Check
		// that this touch has changed.
		if (touch.pageX === event.pageX && touch.pageY === event.pageY) { return; }

		return touch;
	}


	// Handlers that decide when the first movestart is triggered
	
	function mousedown(e){
		var data;

		if (!isLeftButton(e)) { return; }

		data = {
			target: e.target,
			startX: e.pageX,
			startY: e.pageY,
			timeStamp: e.timeStamp
		};

		add(document, mouseevents.move, mousemove, data);
		add(document, mouseevents.cancel, mouseend, data);
	}

	function mousemove(e){
		var data = e.data;

		checkThreshold(e, data, e, removeMouse);
	}

	function mouseend(e) {
		removeMouse();
	}

	function removeMouse() {
		remove(document, mouseevents.move, mousemove);
		remove(document, mouseevents.cancel, mouseend);
	}

	function touchstart(e) {
		var touch, template;

		// Don't get in the way of interaction with form elements.
		if (ignoreTags[ e.target.tagName.toLowerCase() ]) { return; }

		touch = e.changedTouches[0];
		
		// iOS live updates the touch objects whereas Android gives us copies.
		// That means we can't trust the touchstart object to stay the same,
		// so we must copy the data. This object acts as a template for
		// movestart, move and moveend event objects.
		template = {
			target: touch.target,
			startX: touch.pageX,
			startY: touch.pageY,
			timeStamp: e.timeStamp,
			identifier: touch.identifier
		};

		// Use the touch identifier as a namespace, so that we can later
		// remove handlers pertaining only to this touch.
		add(document, touchevents.move + '.' + touch.identifier, touchmove, template);
		add(document, touchevents.cancel + '.' + touch.identifier, touchend, template);
	}

	function touchmove(e){
		var data = e.data,
		    touch = changedTouch(e, data);

		if (!touch) { return; }

		checkThreshold(e, data, touch, removeTouch);
	}

	function touchend(e) {
		var template = e.data,
		    touch = identifiedTouch(e.changedTouches, template.identifier);

		if (!touch) { return; }

		removeTouch(template.identifier);
	}

	function removeTouch(identifier) {
		remove(document, '.' + identifier, touchmove);
		remove(document, '.' + identifier, touchend);
	}


	// Logic for deciding when to trigger a movestart.

	function checkThreshold(e, template, touch, fn) {
		var distX = touch.pageX - template.startX,
		    distY = touch.pageY - template.startY;

		// Do nothing if the threshold has not been crossed.
		if ((distX * distX) + (distY * distY) < (threshold * threshold)) { return; }

		triggerStart(e, template, touch, distX, distY, fn);
	}

	function handled() {
		// this._handled should return false once, and after return true.
		this._handled = returnTrue;
		return false;
	}

	function flagAsHandled(e) {
		e._handled();
	}

	function triggerStart(e, template, touch, distX, distY, fn) {
		var node = template.target,
		    touches, time;

		touches = e.targetTouches;
		time = e.timeStamp - template.timeStamp;

		// Create a movestart object with some special properties that
		// are passed only to the movestart handlers.
		template.type = 'movestart';
		template.distX = distX;
		template.distY = distY;
		template.deltaX = distX;
		template.deltaY = distY;
		template.pageX = touch.pageX;
		template.pageY = touch.pageY;
		template.velocityX = distX / time;
		template.velocityY = distY / time;
		template.targetTouches = touches;
		template.finger = touches ?
			touches.length :
			1 ;

		// The _handled method is fired to tell the default movestart
		// handler that one of the move events is bound.
		template._handled = handled;
			
		// Pass the touchmove event so it can be prevented if or when
		// movestart is handled.
		template._preventTouchmoveDefault = function() {
			e.preventDefault();
		};

		// Trigger the movestart event.
		trigger(template.target, template);

		// Unbind handlers that tracked the touch or mouse up till now.
		fn(template.identifier);
	}


	// Handlers that control what happens following a movestart

	function activeMousemove(e) {
		var timer = e.data.timer;

		e.data.touch = e;
		e.data.timeStamp = e.timeStamp;
		timer.kick();
	}

	function activeMouseend(e) {
		var event = e.data.event,
		    timer = e.data.timer;
		
		removeActiveMouse();

		endEvent(event, timer, function() {
			// Unbind the click suppressor, waiting until after mouseup
			// has been handled.
			setTimeout(function(){
				remove(event.target, 'click', returnFalse);
			}, 0);
		});
	}

	function removeActiveMouse(event) {
		remove(document, mouseevents.move, activeMousemove);
		remove(document, mouseevents.end, activeMouseend);
	}

	function activeTouchmove(e) {
		var event = e.data.event,
		    timer = e.data.timer,
		    touch = changedTouch(e, event);

		if (!touch) { return; }

		// Stop the interface from gesturing
		e.preventDefault();

		event.targetTouches = e.targetTouches;
		e.data.touch = touch;
		e.data.timeStamp = e.timeStamp;
		timer.kick();
	}

	function activeTouchend(e) {
		var event = e.data.event,
		    timer = e.data.timer,
		    touch = identifiedTouch(e.changedTouches, event.identifier);

		// This isn't the touch you're looking for.
		if (!touch) { return; }

		removeActiveTouch(event);
		endEvent(event, timer);
	}

	function removeActiveTouch(event) {
		remove(document, '.' + event.identifier, activeTouchmove);
		remove(document, '.' + event.identifier, activeTouchend);
	}


	// Logic for triggering move and moveend events

	function updateEvent(event, touch, timeStamp, timer) {
		var time = timeStamp - event.timeStamp;

		event.type = 'move';
		event.distX =  touch.pageX - event.startX;
		event.distY =  touch.pageY - event.startY;
		event.deltaX = touch.pageX - event.pageX;
		event.deltaY = touch.pageY - event.pageY;
		
		// Average the velocity of the last few events using a decay
		// curve to even out spurious jumps in values.
		event.velocityX = 0.3 * event.velocityX + 0.7 * event.deltaX / time;
		event.velocityY = 0.3 * event.velocityY + 0.7 * event.deltaY / time;
		event.pageX =  touch.pageX;
		event.pageY =  touch.pageY;
	}

	function endEvent(event, timer, fn) {
		timer.end(function(){
			event.type = 'moveend';

			trigger(event.target, event);
			
			return fn && fn();
		});
	}


	// jQuery special event definition

	function setup(data, namespaces, eventHandle) {
		// Stop the node from being dragged
		//add(this, 'dragstart.move drag.move', preventDefault);
		
		// Prevent text selection and touch interface scrolling
		//add(this, 'mousedown.move', preventIgnoreTags);
		
		// Tell movestart default handler that we've handled this
		add(this, 'movestart.move', flagAsHandled);

		// Don't bind to the DOM. For speed.
		return true;
	}
	
	function teardown(namespaces) {
		remove(this, 'dragstart drag', preventDefault);
		remove(this, 'mousedown touchstart', preventIgnoreTags);
		remove(this, 'movestart', flagAsHandled);
		
		// Don't bind to the DOM. For speed.
		return true;
	}
	
	function addMethod(handleObj) {
		// We're not interested in preventing defaults for handlers that
		// come from internal move or moveend bindings
		if (handleObj.namespace === "move" || handleObj.namespace === "moveend") {
			return;
		}
		
		// Stop the node from being dragged
		add(this, 'dragstart.' + handleObj.guid + ' drag.' + handleObj.guid, preventDefault, undefined, handleObj.selector);
		
		// Prevent text selection and touch interface scrolling
		add(this, 'mousedown.' + handleObj.guid, preventIgnoreTags, undefined, handleObj.selector);
	}
	
	function removeMethod(handleObj) {
		if (handleObj.namespace === "move" || handleObj.namespace === "moveend") {
			return;
		}
		
		remove(this, 'dragstart.' + handleObj.guid + ' drag.' + handleObj.guid);
		remove(this, 'mousedown.' + handleObj.guid);
	}
	
	jQuery.event.special.movestart = {
		setup: setup,
		teardown: teardown,
		add: addMethod,
		remove: removeMethod,

		_default: function(e) {
			var event, data;
			
			// If no move events were bound to any ancestors of this
			// target, high tail it out of here.
			if (!e._handled()) { return; }

			function update(time) {
				updateEvent(event, data.touch, data.timeStamp);
				trigger(e.target, event);
			}

			event = {
				target: e.target,
				startX: e.startX,
				startY: e.startY,
				pageX: e.pageX,
				pageY: e.pageY,
				distX: e.distX,
				distY: e.distY,
				deltaX: e.deltaX,
				deltaY: e.deltaY,
				velocityX: e.velocityX,
				velocityY: e.velocityY,
				timeStamp: e.timeStamp,
				identifier: e.identifier,
				targetTouches: e.targetTouches,
				finger: e.finger
			};

			data = {
				event: event,
				timer: new Timer(update),
				touch: undefined,
				timeStamp: undefined
			};
			
			if (e.identifier === undefined) {
				// We're dealing with a mouse
				// Stop clicks from propagating during a move
				add(e.target, 'click', returnFalse);
				add(document, mouseevents.move, activeMousemove, data);
				add(document, mouseevents.end, activeMouseend, data);
			}
			else {
				// We're dealing with a touch. Stop touchmove doing
				// anything defaulty.
				e._preventTouchmoveDefault();
				add(document, touchevents.move + '.' + e.identifier, activeTouchmove, data);
				add(document, touchevents.end + '.' + e.identifier, activeTouchend, data);
			}
		}
	};

	jQuery.event.special.move = {
		setup: function() {
			// Bind a noop to movestart. Why? It's the movestart
			// setup that decides whether other move events are fired.
			add(this, 'movestart.move', jQuery.noop);
		},
		
		teardown: function() {
			remove(this, 'movestart.move', jQuery.noop);
		}
	};
	
	jQuery.event.special.moveend = {
		setup: function() {
			// Bind a noop to movestart. Why? It's the movestart
			// setup that decides whether other move events are fired.
			add(this, 'movestart.moveend', jQuery.noop);
		},
		
		teardown: function() {
			remove(this, 'movestart.moveend', jQuery.noop);
		}
	};

	add(document, 'mousedown.move', mousedown);
	add(document, 'touchstart.move', touchstart);

	// Make jQuery copy touch event properties over to the jQuery event
	// object, if they are not already listed. But only do the ones we
	// really need. IE7/8 do not have Array#indexOf(), but nor do they
	// have touch events, so let's assume we can ignore them.
	if (typeof Array.prototype.indexOf === 'function') {
		(function(jQuery, undefined){
			var props = ["changedTouches", "targetTouches"],
			    l = props.length;
			
			while (l--) {
				if (jQuery.event.props.indexOf(props[l]) === -1) {
					jQuery.event.props.push(props[l]);
				}
			}
		})(jQuery);
	};
});


// jQuery.event.swipe
// 0.5
// Stephen Band

// Dependencies
// jQuery.event.move 1.2

// One of swipeleft, swiperight, swipeup or swipedown is triggered on
// moveend, when the move has covered a threshold ratio of the dimension
// of the target node, or has gone really fast. Threshold and velocity
// sensitivity changed with:
//
// jQuery.event.special.swipe.settings.threshold
// jQuery.event.special.swipe.settings.sensitivity

(function (module) {
	if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define(['jquery'], module);
	} else {
		// Browser globals
		module(jQuery);
	}
})(function(jQuery, undefined){
	var add = jQuery.event.add,
	   
	    remove = jQuery.event.remove,

	    // Just sugar, so we can have arguments in the same order as
	    // add and remove.
	    trigger = function(node, type, data) {
	    	jQuery.event.trigger(type, data, node);
	    },

	    settings = {
	    	// Ratio of distance over target finger must travel to be
	    	// considered a swipe.
	    	threshold: 0.4,
	    	// Faster fingers can travel shorter distances to be considered
	    	// swipes. 'sensitivity' controls how much. Bigger is shorter.
	    	sensitivity: 6
	    };

	function moveend(e) {
		var w, h, event;

		w = e.currentTarget.offsetWidth;
		h = e.currentTarget.offsetHeight;

		// Copy over some useful properties from the move event
		event = {
			distX: e.distX,
			distY: e.distY,
			velocityX: e.velocityX,
			velocityY: e.velocityY,
			finger: e.finger
		};

		// Find out which of the four directions was swiped
		if (e.distX > e.distY) {
			if (e.distX > -e.distY) {
				if (e.distX/w > settings.threshold || e.velocityX * e.distX/w * settings.sensitivity > 1) {
					event.type = 'swiperight';
					trigger(e.currentTarget, event);
				}
			}
			else {
				if (-e.distY/h > settings.threshold || e.velocityY * e.distY/w * settings.sensitivity > 1) {
					event.type = 'swipeup';
					trigger(e.currentTarget, event);
				}
			}
		}
		else {
			if (e.distX > -e.distY) {
				if (e.distY/h > settings.threshold || e.velocityY * e.distY/w * settings.sensitivity > 1) {
					event.type = 'swipedown';
					trigger(e.currentTarget, event);
				}
			}
			else {
				if (-e.distX/w > settings.threshold || e.velocityX * e.distX/w * settings.sensitivity > 1) {
					event.type = 'swipeleft';
					trigger(e.currentTarget, event);
				}
			}
		}
	}

	function getData(node) {
		var data = jQuery.data(node, 'event_swipe');
		
		if (!data) {
			data = { count: 0 };
			jQuery.data(node, 'event_swipe', data);
		}
		
		return data;
	}

	jQuery.event.special.swipe =
	jQuery.event.special.swipeleft =
	jQuery.event.special.swiperight =
	jQuery.event.special.swipeup =
	jQuery.event.special.swipedown = {
		setup: function( data, namespaces, eventHandle ) {
			var data = getData(this);

			// If another swipe event is already setup, don't setup again.
			if (data.count++ > 0) { return; }

			add(this, 'moveend', moveend);

			return true;
		},

		teardown: function() {
			var data = getData(this);

			// If another swipe event is still setup, don't teardown.
			if (--data.count > 0) { return; }

			remove(this, 'moveend', moveend);

			return true;
		},

		settings: settings
	};
});


(function(e,t){var n=function(){function r(t,r){if(t=="dot"){r='<ol class="dots">';e.each(n.li,function(e){r+='<li class="'+(e==n.i?t+" active":t)+'">'+ ++e+"</li>"});r+="</ol>"}else{r='<div class="';r=r+t+'s">'+r+t+' prev">'+n.o.prev+"</div>"+r+t+' next">'+n.o.next+"</div></div>"}n.el.addClass("has-"+t+"s").append(r).find("."+t).click(function(){var t=e(this);t.hasClass("dot")?n.stop().to(t.index()):t.hasClass("prev")?n.prev():n.next()})}var n=this;n.o={speed:500,delay:3e3,init:0,pause:!t,loop:!t,keys:t,dots:t,arrows:t,prev:"←",next:"→",fluid:t,starting:t,complete:t,items:">ul",item:">li",easing:"swing",autoplay:true};n.init=function(t,i){n.o=e.extend(n.o,i);n.el=t;n.ul=t.find(n.o.items);n.max=[t.outerWidth()|0,t.outerHeight()|0];n.li=n.ul.find(n.o.item).each(function(t){var r=e(this),i=r.outerWidth(),s=r.outerHeight();if(i>n.max[0])n.max[0]=i;if(s>n.max[1])n.max[1]=s});var i=n.o,s=n.ul,o=n.li,u=o.length;n.i=0;t.css({width:n.max[0],height:o.first().outerHeight(),overflow:"hidden"});s.css({position:"relative",left:0,width:u*100+"%"});o.css({"float":"left",width:n.max[0]+"px"});i.autoplay&&setTimeout(function(){if(i.delay|0){n.play();if(i.pause){t.on("mouseover mouseout",function(e){n.stop();e.type=="mouseout"&&n.play()})}}},i.init|0);if(i.keys){e(document).keydown(function(e){var t=e.which;if(t==37)n.prev();else if(t==39)n.next();else if(t==27)n.stop()})}i.dots&&r("dot");i.arrows&&r("arrow");if(i.fluid){e(window).resize(function(){n.r&&clearTimeout(n.r);n.r=setTimeout(function(){var e={height:o.eq(n.i).outerHeight()},r=t.outerWidth();s.css(e);e["width"]=Math.min(Math.round(r/t.parent().width()*100),100)+"%";t.css(e)},50)}).resize()}if(e.event.special["swipe"]||e.Event("swipe")){t.on("swipeleft swiperight swipeLeft swipeRight",function(e){e.type.toLowerCase()=="swipeleft"?n.next():n.prev()})}return n};n.to=function(r,i){if(n.t){n.stop();n.play()}var s=n.o,o=n.el,u=n.ul,a=n.li,l=n.i,c=a.eq(r);e.isFunction(s.starting)&&!i&&s.starting(o,a.eq(l));if((!c.length||r<0)&&s.loop==t)return;if(!c.length)r=0;if(r<0)r=a.length-1;c=a.eq(r);var h=i?5:s.speed|0,p=s.easing,d={height:c.outerHeight()};if(!u.queue("fx").length){o.find(".dot").eq(r).addClass("active").siblings().removeClass("active");o.animate(d,h,p)&&u.animate(e.extend({left:"-"+r+"00%"},d),h,p,function(t){n.i=r;e.isFunction(s.complete)&&!i&&s.complete(o,c)})}};n.play=function(){n.t=setInterval(function(){n.to(n.i+1)},n.o.delay|0)};n.stop=function(){n.t=clearInterval(n.t);return n};n.next=function(){return n.stop().to(n.i+1)};n.prev=function(){return n.stop().to(n.i-1)};};e.fn.unslider=function(t){var r=this.length;return this.each(function(i){var s=e(this),u="unslider"+(r>1?"-"+ ++i:""),a=(new n).init(s,t);s.data(u,a).data("key",u)})};n.version="1.0.0"})(jQuery,false);

/*!
 * classie - class helper functions
 * from bonzo https://github.com/ded/bonzo
 * 
 * classie.has( elem, 'my-class' ) -> true/false
 * classie.add( elem, 'my-new-class' )
 * classie.remove( elem, 'my-unwanted-class' )
 * classie.toggle( elem, 'my-class' )
 */

/*jshint browser: true, strict: true, undef: true */
/*global define: false */

( function( window ) {

	'use strict';

	// class helper functions from bonzo https://github.com/ded/bonzo

	function classReg( className ) {
	  return new RegExp("(^|\\s+)" + className + "(\\s+|$)");
	}

	// classList support for class management
	// altho to be fair, the api sucks because it won't accept multiple classes at once
	var hasClass, addClass, removeClass;

	if ( 'classList' in document.documentElement ) {
		hasClass = function( elem, c ) {
			return elem.classList.contains( c );
		};
		addClass = function( elem, c ) {
			elem.classList.add( c );
		};
		removeClass = function( elem, c ) {
			elem.classList.remove( c );
		};
	} else {
		hasClass = function( elem, c ) {
			return classReg( c ).test( elem.className );
		};
		addClass = function( elem, c ) {
			if ( !hasClass( elem, c ) ) {
				elem.className = elem.className + ' ' + c;
			}
		};
		removeClass = function( elem, c ) {
			elem.className = elem.className.replace( classReg( c ), ' ' );
		};
	}

	function toggleClass( elem, c ) {
		var fn = hasClass( elem, c ) ? removeClass : addClass;
		fn( elem, c );
	}

	var classie = {
		// full names
		hasClass: hasClass,
		addClass: addClass,
		removeClass: removeClass,
		toggleClass: toggleClass,
		// short names
		has: hasClass,
		add: addClass,
		remove: removeClass,
		toggle: toggleClass
	};

	// transport
	if ( typeof define === 'function' && define.amd ) {
		// AMD
		define( classie );
	} else {
		// browser global
		window.classie = classie;
	}

})( window );



/**
 * progressButton.js v1.0.0
 * http://www.codrops.com
 *
 * Licensed under the MIT license.
 * http://www.opensource.org/licenses/mit-license.php
 * 
 * Copyright 2013, Codrops
 * http://www.codrops.com
 */
;( function( window ) {
	
	'use strict';

	// https://gist.github.com/edankwan/4389601
	Modernizr.addTest('csstransformspreserve3d', function () {
		var prop = Modernizr.prefixed('transformStyle');
		var val = 'preserve-3d';
		var computedStyle;
		if(!prop) return false;

		prop = prop.replace(/([A-Z])/g, function(str,m1){ return '-' + m1.toLowerCase(); }).replace(/^ms-/,'-ms-');

		Modernizr.testStyles('#modernizr{' + prop + ':' + val + ';}', function (el, rule) {
			computedStyle = window.getComputedStyle ? getComputedStyle(el, null).getPropertyValue(prop) : '';
		});

		return (computedStyle === val);
	});

	function extend( a, b ) {
		for( var key in b ) { 
			if( b.hasOwnProperty( key ) ) {
				a[key] = b[key];
			}
		}
		return a;
	}

	// support
	var support = { transitions : Modernizr.csstransitions, transforms3d : Modernizr.csstransforms3d && Modernizr.csstransformspreserve3d },
		// transition end event name
		transEndEventNames = {
			'WebkitTransition': 'webkitTransitionEnd',
			'MozTransition': 'transitionend',
			'OTransition': 'oTransitionEnd',
			'msTransition': 'MSTransitionEnd',
			'transition': 'transitionend'
		},
		transEndEventName = transEndEventNames[ Modernizr.prefixed( 'transition' ) ];

	function ProgressButton( el, options ) {
		this.button = el;
		this.options = extend( {}, this.options );
		extend( this.options, options );
		this._init();
	}

	ProgressButton.prototype.options = {
		// time in ms that the status (success or error will be displayed)
		// during this time the button will be disabled
		statusTime : 1500
	};

	ProgressButton.prototype._init = function() {
		this._validate();
		// create structure
		this._create();
		// init events
		this._initEvents();
	};

	ProgressButton.prototype._validate = function() {
		// we will consider the fill/horizontal as default
		if( this.button.getAttribute( 'data-style' ) === null ) {
			this.button.setAttribute( 'data-style', 'fill' );
		}
		if( this.button.getAttribute( 'data-vertical' ) === null && this.button.getAttribute( 'data-horizontal' ) === null ) {
			this.button.setAttribute( 'data-horizontal', '' );
		}
		if( !support.transforms3d && this.button.getAttribute( 'data-perspective' ) !== null ) {
			this.button.removeAttribute( 'data-perspective' );
			this.button.setAttribute( 'data-style', 'fill' );
			this.button.removeAttribute( 'data-vertical' );
			this.button.setAttribute( 'data-horizontal', '' );
		}
	};

	ProgressButton.prototype._create = function() {
		var textEl = document.createElement( 'span' );
		textEl.className = 'content';
		textEl.innerHTML = this.button.innerHTML;
		var progressEl = document.createElement( 'span' );
		progressEl.className = 'progress';

		var progressInnerEl = document.createElement( 'span' );
		progressInnerEl.className = 'progress-inner';
		progressEl.appendChild( progressInnerEl );
		// clear content
		this.button.innerHTML = '';

		if( this.button.getAttribute( 'data-perspective' ) !== null ) {
			var progressWrapEl = document.createElement( 'span' );
			progressWrapEl.className = 'progress-wrap';
			progressWrapEl.appendChild( textEl );
			progressWrapEl.appendChild( progressEl );
			this.button.appendChild( progressWrapEl );
		} else {
			this.button.appendChild( textEl );
			this.button.appendChild( progressEl );
		}
		
		// the element that serves as the progress bar
		this.progress = progressInnerEl;

		// property to change on the progress element
		if( this.button.getAttribute( 'data-horizontal' ) !== null ) {
			this.progressProp = 'width';
		} else if( this.button.getAttribute( 'data-vertical' ) !== null ) {
			this.progressProp = 'height';
		}
		this._enable();
	};

	ProgressButton.prototype._setProgress = function( val ) {
		this.progress.style[ this.progressProp ] = 100 * val + '%';
	};

	ProgressButton.prototype._initEvents = function() {
		var self = this;
		this.button.addEventListener( 'click', function() {
			// disable the button
			self.button.setAttribute( 'disabled', '' );
			// add class state-loading to the button (applies a specific transform to the button depending which data-style is defined - defined in the stylesheets)
			classie.remove( self.progress, 'notransition' );
			classie.add( this, 'state-loading' );

			setTimeout( function() {
				if( typeof self.options.callback === 'function' ) {
					self.options.callback( self );
				} else {
					self._setProgress( 1 );
					var onEndTransFn = function( ev ) {
						if( support.transitions && ev.propertyName !== self.progressProp ) return;
						this.removeEventListener( transEndEventName, onEndTransFn );
						self._stop();
					};
					
					if( support.transitions ) {
						self.progress.addEventListener( transEndEventName, onEndTransFn );
					} else {
						onEndTransFn.call();
					}
					
				}
			}, 
			self.button.getAttribute( 'data-style' ) === 'fill' || 
			self.button.getAttribute( 'data-style' ) === 'top-line' ||
			self.button.getAttribute( 'data-style' ) === 'lateral-lines' ? 0 : 200 ); // TODO: change timeout to transitionend event callback
		} );
	};

	ProgressButton.prototype._stop = function( status ) {
		var self = this;

		setTimeout( function() {
			// fade out progress bar
			self.progress.style.opacity = 0;
			var onEndTransFn = function( ev ) {
				if( support.transitions && ev.propertyName !== 'opacity' ) return;
				this.removeEventListener( transEndEventName, onEndTransFn );
				classie.add( self.progress, 'notransition' );
				self.progress.style[ self.progressProp ] = '0%';
				self.progress.style.opacity = 1;
			};

			if( support.transitions ) {
				self.progress.addEventListener( transEndEventName, onEndTransFn );
			} else {
				onEndTransFn.call();
			}
			
			
			// add class state-success to the button
			if( typeof status === 'number' ) {
				var statusClass = status >= 0 ? 'state-success' : 'state-error';
				classie.add( self.button, statusClass );
				// after options.statusTime remove status
				setTimeout( function() {
					classie.remove( self.button, statusClass );
					self._enable();
				}, self.options.statusTime );
			} else {
				self._enable();
			}

			// remove class state-loading from the button
			classie.remove( self.button, 'state-loading' );
		}, 100 );
	};

	// enable button
	ProgressButton.prototype._enable = function() {
		this.button.removeAttribute( 'disabled' );
	}

	// add to global namespace
	window.ProgressButton = ProgressButton;

})( window );


/*	
 * jQuery mmenu v4.2.3
 * @requires jQuery 1.7.0 or later
 *
 * mmenu.frebsite.nl
 *	
 * Copyright (c) Fred Heusschen
 * www.frebsite.nl
 *
 * Dual licensed under the MIT and GPL licenses.
 * http://en.wikipedia.org/wiki/MIT_License
 * http://en.wikipedia.org/wiki/GNU_General_Public_License
 */
!function(e){function t(t,n,s){if(s){if("object"!=typeof t&&(t={}),"boolean"!=typeof t.isMenu){var o=s.children();t.isMenu=1==o.length&&o.is(n.panelNodetype)}return t}return t=e.extend(!0,{},e[a].defaults,t),("top"==t.position||"bottom"==t.position)&&("back"==t.zposition||"next"==t.zposition)&&(e[a].deprecated('Using position "'+t.position+'" in combination with zposition "'+t.zposition+'"','zposition "front"'),t.zposition="front"),t}function n(t){return t=e.extend(!0,{},e[a].configuration,t),"string"!=typeof t.pageSelector&&(t.pageSelector="> "+t.pageNodetype),"append"!=t.menuInjectMethod&&(t.menuInjectMethod="prepend"),t}function s(){r.$wndw=e(window),r.$html=e("html"),r.$body=e("body"),r.$allMenus=e(),e.each([d,c,u],function(e,t){t.add=function(e){e=e.split(" ");for(var n in e)t[e[n]]=t.mm(e[n])}}),d.mm=function(e){return"mm-"+e},d.add("menu ismenu panel list subtitle selected label spacer current highest hidden page blocker modal background opened opening subopened subopen fullsubopen subclose"),d.umm=function(e){return"mm-"==e.slice(0,3)&&(e=e.slice(3)),e},c.mm=function(e){return"mm-"+e},c.add("parent style"),u.mm=function(e){return e+".mm"},u.add("toggle open opening opened close closing closed update setPage setSelected transitionend webkitTransitionEnd mousedown touchstart mouseup touchend scroll touchmove click keydown keyup resize"),r.$wndw.on(u.keydown,function(e){return r.$html.hasClass(d.opened)&&9==e.keyCode?(e.preventDefault(),!1):void 0});var t=0;r.$wndw.on(u.resize,function(e,n){if(n||r.$html.hasClass(d.opened)){var s=r.$wndw.height();(n||s!=t)&&(t=s,r.$page.css("minHeight",s))}}),e[a]._c=d,e[a]._d=c,e[a]._e=u,e[a].glbl=r}function o(t,n){if(t.hasClass(d.current))return!1;var s=e("."+d.panel,n),o=s.filter("."+d.current);return s.removeClass(d.highest).removeClass(d.current).not(t).not(o).addClass(d.hidden),t.hasClass(d.opened)?o.addClass(d.highest).removeClass(d.opened).removeClass(d.subopened):(t.addClass(d.highest),o.addClass(d.subopened)),t.removeClass(d.hidden).removeClass(d.subopened).addClass(d.current).addClass(d.opened),"open"}function i(e,t,n){var s=!1,o=function(){s||t.call(e[0]),s=!0};e.one(u.transitionend,o),e.one(u.webkitTransitionEnd,o),setTimeout(o,1.1*n)}var a="mmenu",l="4.2.3";if(!e[a]){var r={$wndw:null,$html:null,$body:null,$page:null,$blck:null,$allMenus:null},d={},c={},u={},p=0,h=0;e[a]=function(e,t,n){return r.$allMenus=r.$allMenus.add(e),this.$menu=e,this.opts=t,this.conf=n,this.serialnr=p++,this._init(),this},e[a].prototype={open:function(){var e=this;return this._openSetup(),setTimeout(function(){e._openFinish()},50),"open"},_openSetup:function(){h=r.$wndw.scrollTop(),this.$menu.addClass(d.current),r.$allMenus.not(this.$menu).trigger(u.close),r.$page.data(c.style,r.$page.attr("style")||""),r.$wndw.trigger(u.resize,[!0]),this.opts.modal&&r.$html.addClass(d.modal),this.opts.moveBackground&&r.$html.addClass(d.background),"left"!=this.opts.position&&r.$html.addClass(d.mm(this.opts.position)),"back"!=this.opts.zposition&&r.$html.addClass(d.mm(this.opts.zposition)),this.opts.classes&&r.$html.addClass(this.opts.classes),r.$html.addClass(d.opened),this.$menu.addClass(d.opened)},_openFinish:function(){var e=this;i(r.$page,function(){e.$menu.trigger(u.opened)},this.conf.transitionDuration),r.$html.addClass(d.opening),this.$menu.trigger(u.opening)},close:function(){var e=this;return i(r.$page,function(){e.$menu.removeClass(d.current).removeClass(d.opened),r.$html.removeClass(d.opened).removeClass(d.modal).removeClass(d.background).removeClass(d.mm(e.opts.position)).removeClass(d.mm(e.opts.zposition)),e.opts.classes&&r.$html.removeClass(e.opts.classes),r.$page.attr("style",r.$page.data(c.style)),e.$menu.trigger(u.closed)},this.conf.transitionDuration),r.$html.removeClass(d.opening),this.$menu.trigger(u.closing),"close"},_init:function(){if(this.opts=t(this.opts,this.conf,this.$menu),this.direction=this.opts.slidingSubmenus?"horizontal":"vertical",this._initPage(r.$page),this._initMenu(),this._initBlocker(),this._initPanles(),this._initLinks(),this._initOpenClose(),this._bindCustomEvents(),e[a].addons)for(var n=0;n<e[a].addons.length;n++)"function"==typeof this["_addon_"+e[a].addons[n]]&&this["_addon_"+e[a].addons[n]]()},_bindCustomEvents:function(){var t=this;this.$menu.off(u.open+" "+u.close+" "+u.setPage+" "+u.update).on(u.open+" "+u.close+" "+u.setPage+" "+u.update,function(e){e.stopPropagation()}),this.$menu.on(u.open,function(n){return e(this).hasClass(d.current)?(n.stopImmediatePropagation(),!1):t.open()}).on(u.close,function(n){return e(this).hasClass(d.current)?t.close():(n.stopImmediatePropagation(),!1)}).on(u.setPage,function(e,n){t._initPage(n),t._initOpenClose()});var n=this.$menu.find(this.opts.isMenu&&"horizontal"!=this.direction?"ul, ol":"."+d.panel);n.off(u.toggle+" "+u.open+" "+u.close).on(u.toggle+" "+u.open+" "+u.close,function(e){e.stopPropagation()}),"horizontal"==this.direction?n.on(u.open,function(){return o(e(this),t.$menu)}):n.on(u.toggle,function(){var t=e(this);return t.triggerHandler(t.parent().hasClass(d.opened)?u.close:u.open)}).on(u.open,function(){return e(this).parent().addClass(d.opened),"open"}).on(u.close,function(){return e(this).parent().removeClass(d.opened),"close"})},_initBlocker:function(){var t=this;r.$blck||(r.$blck=e('<div id="'+d.blocker+'" />').appendTo(r.$body)),r.$blck.off(u.touchstart).on(u.touchstart,function(e){e.preventDefault(),e.stopPropagation(),r.$blck.trigger(u.mousedown)}).on(u.mousedown,function(e){e.preventDefault(),r.$html.hasClass(d.modal)||t.$menu.trigger(u.close)})},_initPage:function(t){t||(t=e(this.conf.pageSelector,r.$body),t.length>1&&(e[a].debug("Multiple nodes found for the page-node, all nodes are wrapped in one <"+this.conf.pageNodetype+">."),t=t.wrapAll("<"+this.conf.pageNodetype+" />").parent())),t.addClass(d.page),r.$page=t},_initMenu:function(){this.conf.clone&&(this.$menu=this.$menu.clone(!0),this.$menu.add(this.$menu.find("*")).filter("[id]").each(function(){e(this).attr("id",d.mm(e(this).attr("id")))})),this.$menu.contents().each(function(){3==e(this)[0].nodeType&&e(this).remove()}),this.$menu[this.conf.menuInjectMethod+"To"](this.conf.menuWrapperSelector).addClass(d.menu),this.$menu.addClass(d.mm(this.direction)),this.opts.classes&&this.$menu.addClass(this.opts.classes),this.opts.isMenu&&this.$menu.addClass(d.ismenu),"left"!=this.opts.position&&this.$menu.addClass(d.mm(this.opts.position)),"back"!=this.opts.zposition&&this.$menu.addClass(d.mm(this.opts.zposition))},_initPanles:function(){var t=this;this.__refactorClass(e("."+this.conf.listClass,this.$menu),"list"),this.opts.isMenu&&e("ul, ol",this.$menu).not(".mm-nolist").addClass(d.list);var n=e("."+d.list+" > li",this.$menu);this.__refactorClass(n.filter("."+this.conf.selectedClass),"selected"),this.__refactorClass(n.filter("."+this.conf.labelClass),"label"),this.__refactorClass(n.filter("."+this.conf.spacerClass),"spacer"),n.off(u.setSelected).on(u.setSelected,function(t,s){t.stopPropagation(),n.removeClass(d.selected),"boolean"!=typeof s&&(s=!0),s&&e(this).addClass(d.selected)}),this.__refactorClass(e("."+this.conf.panelClass,this.$menu),"panel"),this.$menu.children().filter(this.conf.panelNodetype).add(this.$menu.find("."+d.list).children().children().filter(this.conf.panelNodetype)).addClass(d.panel);var s=e("."+d.panel,this.$menu);s.each(function(n){var s=e(this),o=s.attr("id")||d.mm("m"+t.serialnr+"-p"+n);s.attr("id",o)}),s.find("."+d.panel).each(function(){var n=e(this),s=n.is("ul, ol")?n:n.find("ul ,ol").first(),o=n.parent(),i=o.find("> a, > span"),a=o.closest("."+d.panel);if(n.data(c.parent,o),o.parent().is("."+d.list)){var l=e('<a class="'+d.subopen+'" href="#'+n.attr("id")+'" />').insertBefore(i);i.is("a")||l.addClass(d.fullsubopen),"horizontal"==t.direction&&s.prepend('<li class="'+d.subtitle+'"><a class="'+d.subclose+'" href="#'+a.attr("id")+'">'+i.text()+"</a></li>")}});var o="horizontal"==this.direction?u.open:u.toggle;if(s.each(function(){var n=e(this),s=n.attr("id");e('a[href="#'+s+'"]',t.$menu).off(u.click).on(u.click,function(e){e.preventDefault(),n.trigger(o)})}),"horizontal"==this.direction){var i=e("."+d.list+" > li."+d.selected,this.$menu);i.add(i.parents("li")).parents("li").removeClass(d.selected).end().each(function(){var t=e(this),n=t.find("> ."+d.panel);n.length&&(t.parents("."+d.panel).addClass(d.subopened),n.addClass(d.opened))}).closest("."+d.panel).addClass(d.opened).parents("."+d.panel).addClass(d.subopened)}else e("li."+d.selected,this.$menu).addClass(d.opened).parents("."+d.selected).removeClass(d.selected);var a=s.filter("."+d.opened);a.length||(a=s.first()),a.addClass(d.opened).last().addClass(d.current),"horizontal"==this.direction&&s.find("."+d.panel).appendTo(this.$menu)},_initLinks:function(){var t=this;e("."+d.list+" > li > a",this.$menu).not("."+d.subopen).not("."+d.subclose).not('[rel="external"]').not('[target="_blank"]').off(u.click).on(u.click,function(n){var s=e(this),o=s.attr("href");t.__valueOrFn(t.opts.onClick.setSelected,s)&&s.parent().trigger(u.setSelected);var i=t.__valueOrFn(t.opts.onClick.preventDefault,s,"#"==o.slice(0,1));i&&n.preventDefault(),t.__valueOrFn(t.opts.onClick.blockUI,s,!i)&&r.$html.addClass(d.blocking),t.__valueOrFn(t.opts.onClick.close,s,i)&&t.$menu.triggerHandler(u.close)})},_initOpenClose:function(){var t=this,n=this.$menu.attr("id");n&&n.length&&(this.conf.clone&&(n=d.umm(n)),e('a[href="#'+n+'"]').off(u.click).on(u.click,function(e){e.preventDefault(),t.$menu.trigger(u.open)}));var n=r.$page.attr("id");n&&n.length&&e('a[href="#'+n+'"]').off(u.click).on(u.click,function(e){e.preventDefault(),t.$menu.trigger(u.close)})},__valueOrFn:function(e,t,n){return"function"==typeof e?e.call(t[0]):"undefined"==typeof e&&"undefined"!=typeof n?n:e},__refactorClass:function(e,t){e.removeClass(this.conf[t+"Class"]).addClass(d[t])}},e.fn[a]=function(o,i){return r.$wndw||s(),o=t(o,i),i=n(i),this.each(function(){var t=e(this);t.data(a)||t.data(a,new e[a](t,o,i))})},e[a].version=l,e[a].defaults={position:"left",zposition:"back",moveBackground:!0,slidingSubmenus:!0,modal:!1,classes:"",onClick:{setSelected:!0}},e[a].configuration={panelClass:"Panel",listClass:"List",selectedClass:"Selected",labelClass:"Label",spacerClass:"Spacer",pageNodetype:"div",panelNodetype:"ul, ol, div",pageSelector:null,menuWrapperSelector:"body",menuInjectMethod:"prepend",transitionDuration:400},function(){var t=window.document,n=window.navigator.userAgent,s=(document.createElement("div").style,"ontouchstart"in t),o="WebkitOverflowScrolling"in t.documentElement.style,i=function(){return n.indexOf("Android")>=0?2.4>parseFloat(n.slice(n.indexOf("Android")+8)):!1}();e[a].support={touch:s,oldAndroidBrowser:i,overflowscrolling:function(){return s?o?!0:i?!1:!0:!0}()}}(),e[a].debug=function(){},e[a].deprecated=function(e,t){"undefined"!=typeof console&&"undefined"!=typeof console.warn&&console.warn("MMENU: "+e+" is deprecated, use "+t+" instead.")}}}(jQuery);
/*	
 * jQuery mmenu counters addon
 * @requires mmenu 4.0.0 or later
 *
 * mmenu.frebsite.nl
 *	
 * Copyright (c) Fred Heusschen
 * www.frebsite.nl
 *
 * Dual licensed under the MIT and GPL licenses.
 * http://en.wikipedia.org/wiki/MIT_License
 * http://en.wikipedia.org/wiki/GNU_General_Public_License
 */
!function(t){var e="mmenu",n="counters";t[e].prototype["_addon_"+n]=function(){var o=this,u=this.opts[n],a=t[e]._c,r=t[e]._d,d=t[e]._e;a.add("counter noresults"),d.add("updatecounters"),"boolean"==typeof u&&(u={add:u,update:u}),"object"!=typeof u&&(u={}),u=t.extend(!0,{},t[e].defaults[n],u),u.count&&(t[e].deprecated('the option "count" for counters, the option "update"'),u.update=u.count),this.__refactorClass(t("em."+this.conf.counterClass,this.$menu),"counter");var s=t("."+a.panel,this.$menu);if(u.add&&s.each(function(){var e=t(this),n=e.data(r.parent);if(n){var o=t('<em class="'+a.counter+'" />'),u=n.find("> a."+a.subopen);u.parent().find("em."+a.counter).length||u.before(o)}}),u.update){var c=t("em."+a.counter,this.$menu);c.off(d.updatecounters).on(d.updatecounters,function(t){t.stopPropagation()}).each(function(){var e=t(this),n=t(e.next().attr("href"),o.$menu);n.is("."+a.list)||(n=n.find("> ."+a.list)),n.length&&e.on(d.updatecounters,function(){var t=n.children().not("."+a.label).not("."+a.subtitle).not("."+a.hidden).not("."+a.noresults);e.html(t.length)})}).trigger(d.updatecounters),this.$menu.on(d.update,function(){c.trigger(d.updatecounters)})}},t[e].defaults[n]={add:!1,update:!1},t[e].configuration.counterClass="Counter",t[e].addons=t[e].addons||[],t[e].addons.push(n)}(jQuery);
/*	
 * jQuery mmenu dragOpen addon
 * @requires mmenu 4.0.0 or later
 *
 * mmenu.frebsite.nl
 *	
 * Copyright (c) Fred Heusschen
 * www.frebsite.nl
 *
 * Dual licensed under the MIT and GPL licenses.
 * http://en.wikipedia.org/wiki/MIT_License
 * http://en.wikipedia.org/wiki/GNU_General_Public_License
 */
!function(e){function t(e,t,a){return t>e&&(e=t),e>a&&(e=a),e}var a="mmenu",o="dragOpen";e[a].prototype["_addon_"+o]=function(){var n=this,r=this.opts[o];if(e.fn.hammer){var i=e[a]._c,s=(e[a]._d,e[a]._e);i.add("dragging"),s.add("dragleft dragright dragup dragdown dragend");var d=e[a].glbl;if("boolean"==typeof r&&(r={open:r}),"object"!=typeof r&&(r={}),"number"!=typeof r.maxStartPos&&(r.maxStartPos="left"==this.opts.position||"right"==this.opts.position?150:75),r=e.extend(!0,{},e[a].defaults[o],r),r.open){var p=0,g=!1,c=0,h=0,l="width";switch(this.opts.position){case"left":case"right":l="width";break;default:l="height"}switch(this.opts.position){case"left":var f={events:s.dragleft+" "+s.dragright,open_dir:"right",close_dir:"left",delta:"deltaX",page:"pageX",negative:!1};break;case"right":var f={events:s.dragleft+" "+s.dragright,open_dir:"left",close_dir:"right",delta:"deltaX",page:"pageX",negative:!0};break;case"top":var f={events:s.dragup+" "+s.dragdown,open_dir:"down",close_dir:"up",delta:"deltaY",page:"pageY",negative:!1};break;case"bottom":var f={events:s.dragup+" "+s.dragdown,open_dir:"up",close_dir:"down",delta:"deltaY",page:"pageY",negative:!0}}var u=this.__valueOrFn(r.pageNode,this.$menu,d.$page);"string"==typeof u&&(u=e(u));var m=d.$page.find("."+i.mm("fixed-top")+", ."+i.mm("fixed-bottom")),v=d.$page;switch(n.opts.zposition){case"back":v=v.add(m);break;case"front":v=n.$menu;break;case"next":v=v.add(n.$menu).add(m)}u.hammer().on(s.touchstart+" "+s.mousedown,function(e){if("touchstart"==e.type)var t=e.originalEvent.touches[0]||e.originalEvent.changedTouches[0],a=t[f.page];else if("mousedown"==e.type)var a=e[f.page];switch(n.opts.position){case"right":case"bottom":a>=d.$wndw[l]()-r.maxStartPos&&(p=1);break;default:a<=r.maxStartPos&&(p=1)}}).on(f.events+" "+s.dragend,function(e){p>0&&(e.gesture.preventDefault(),e.stopPropagation())}).on(f.events,function(e){var a=f.negative?-e.gesture[f.delta]:e.gesture[f.delta];if(g=a>c?f.open_dir:f.close_dir,c=a,c>r.threshold&&1==p){if(d.$html.hasClass(i.opened))return;p=2,n._openSetup(),d.$html.addClass(i.dragging),h=t(d.$wndw[l]()*n.conf[o][l].perc,n.conf[o][l].min,n.conf[o][l].max)}2==p&&v.css(n.opts.position,t(c,10,h)-("front"==n.opts.zposition?h:0))}).on(s.dragend,function(){2==p&&(d.$html.removeClass(i.dragging),v.css(n.opts.position,""),g==f.open_dir?n._openFinish():n.close()),p=0})}}},e[a].defaults[o]={open:!1,threshold:50},e[a].configuration[o]={width:{perc:.8,min:140,max:440},height:{perc:.8,min:140,max:880}},e[a].addons=e[a].addons||[],e[a].addons.push(o)}(jQuery);
/*	
 * jQuery mmenu header addon
 * @requires mmenu 4.0.0 or later
 *
 * mmenu.frebsite.nl
 *	
 * Copyright (c) Fred Heusschen
 * www.frebsite.nl
 *
 * Dual licensed under the MIT and GPL licenses.
 * http://en.wikipedia.org/wiki/MIT_License
 * http://en.wikipedia.org/wiki/GNU_General_Public_License
 */
!function(e){var t="mmenu",a="header";e[t].prototype["_addon_"+a]=function(){var n=this,r=this.opts[a],d=this.conf[a],s=e[t]._c,i=(e[t]._d,e[t]._e);s.add("header hasheader prev next title titletext"),i.add("updateheader");var o=e[t].glbl;if("boolean"==typeof r&&(r={add:r,update:r}),"object"!=typeof r&&(r={}),r=e.extend(!0,{},e[t].defaults[a],r),r.add){var h=r.content?r.content:'<a class="'+s.prev+'" href="#"></a><span class="'+s.title+'"></span><a class="'+s.next+'" href="#"></a>';e('<div class="'+s.header+'" />').prependTo(this.$menu).append(h)}var p=e("div."+s.header,this.$menu);if(p.length&&this.$menu.addClass(s.hasheader),r.update&&p.length){var l=p.find("."+s.title),u=p.find("."+s.prev),f=p.find("."+s.next),c="#"+o.$page.attr("id");u.add(f).on(i.click,function(t){t.preventDefault(),t.stopPropagation();var a=e(this).attr("href");"#"!==a&&(a==c?n.$menu.trigger(i.close):e(a,n.$menu).trigger(i.open))}),e("."+s.panel,this.$menu).each(function(){var t=e(this),a=e("."+d.panelHeaderClass,t).text(),n=e("."+d.panelPrevClass,t).attr("href"),o=e("."+d.panelNextClass,t).attr("href");a||(a=e("."+s.subclose,t).text()),a||(a=r.title),n||(n=e("."+s.subclose,t).attr("href")),t.off(i.updateheader).on(i.updateheader,function(e){e.stopPropagation(),l[a?"show":"hide"]().text(a),u[n?"show":"hide"]().attr("href",n),f[o?"show":"hide"]().attr("href",o)}),t.on(i.open,function(){e(this).trigger(i.updateheader)})}).filter("."+s.current).trigger(i.updateheader)}},e[t].defaults[a]={add:!1,content:!1,update:!1,title:"Menu"},e[t].configuration[a]={panelHeaderClass:"Header",panelNextClass:"Next",panelPrevClass:"Prev"},e[t].addons=e[t].addons||[],e[t].addons.push(a)}(jQuery);
/*	
 * jQuery mmenu labels addon
 * @requires mmenu 4.1.0 or later
 *
 * mmenu.frebsite.nl
 *	
 * Copyright (c) Fred Heusschen
 * www.frebsite.nl
 *
 * Dual licensed under the MIT and GPL licenses.
 * http://en.wikipedia.org/wiki/MIT_License
 * http://en.wikipedia.org/wiki/GNU_General_Public_License
 */
!function(e){var l="mmenu",s="labels";e[l].prototype["_addon_"+s]=function(){function a(){var e=t.hassearch&&o.$menu.hasClass(t.hassearch),l=t.hasheader&&o.$menu.hasClass(t.hasheader);return e?l?100:50:l?60:0}var o=this,n=this.opts[s],t=e[l]._c,i=(e[l]._d,e[l]._e);if(t.add("collapsed"),t.add("fixedlabels original clone"),i.add("updatelabels position scroll"),e[l].support.touch&&(i.scroll+=" "+i.mm("touchmove")),"boolean"==typeof n&&(n={collapse:n}),"object"!=typeof n&&(n={}),n=e.extend(!0,{},e[l].defaults[s],n),n.collapse){this.__refactorClass(e("li."+this.conf.collapsedClass,this.$menu),"collapsed");var d=e("."+t.label,this.$menu);d.each(function(){var l=e(this),s=l.nextUntil("."+t.label,"all"==n.collapse?null:"."+t.collapsed);"all"==n.collapse&&(l.addClass(t.opened),s.removeClass(t.collapsed)),s.length&&(l.wrapInner("<span />"),e('<a href="#" class="'+t.subopen+" "+t.fullsubopen+'" />').prependTo(l).on(i.click,function(e){e.preventDefault(),l.toggleClass(t.opened),s[l.hasClass(t.opened)?"removeClass":"addClass"](t.collapsed)}))})}else if(n.fixed){if("horizontal"!=this.direction)return;this.$menu.addClass(t.fixedlabels);var r=e("."+t.panel,this.$menu),d=e("."+t.label,this.$menu);r.add(d).off(i.updatelabels+" "+i.position+" "+i.scroll).on(i.updatelabels+" "+i.position+" "+i.scroll,function(e){e.stopPropagation()});var p=a();r.each(function(){var l=e(this),s=l.find("."+t.label);if(s.length){var o=l.scrollTop();s.each(function(){var s=e(this);s.wrapInner("<div />").wrapInner("<div />");var a,n,d,r=s.find("> div"),c=e();s.on(i.updatelabels,function(){o=l.scrollTop(),s.hasClass(t.hidden)||(c=s.nextAll("."+t.label).not("."+t.hidden).first(),a=s.offset().top+o,n=c.length?c.offset().top+o:!1,d=r.height(),s.trigger(i.position))}),s.on(i.position,function(){var e=0;n&&o+p>n-d?e=n-a-d:o+p>a&&(e=o-a+p),r.css("top",e)})}),l.on(i.updatelabels,function(){o=l.scrollTop(),p=a(),s.trigger(i.position)}).on(i.scroll,function(){s.trigger(i.updatelabels)})}}),this.$menu.on(i.update,function(){r.trigger(i.updatelabels)}).on(i.opening,function(){r.trigger(i.updatelabels).trigger(i.scroll)})}},e[l].defaults[s]={fixed:!1,collapse:!1},e[l].configuration.collapsedClass="Collapsed",e[l].addons=e[l].addons||[],e[l].addons.push(s)}(jQuery);
/*	
 * jQuery mmenu searchfield addon
 * @requires mmenu 4.0.0 or later
 *
 * mmenu.frebsite.nl
 *	
 * Copyright (c) Fred Heusschen
 * www.frebsite.nl
 *
 * Dual licensed under the MIT and GPL licenses.
 * http://en.wikipedia.org/wiki/MIT_License
 * http://en.wikipedia.org/wiki/GNU_General_Public_License
 */
!function(e){function s(e){switch(e){case 9:case 16:case 17:case 18:case 37:case 38:case 39:case 40:return!0}return!1}var n="mmenu",t="searchfield";e[n].prototype["_addon_"+t]=function(){var a=this,r=this.opts[t],o=e[n]._c,l=e[n]._d,d=e[n]._e;if(o.add("search hassearch noresults nosubresults counter"),d.add("search reset change"),"boolean"==typeof r&&(r={add:r,search:r}),"object"!=typeof r&&(r={}),r=e.extend(!0,{},e[n].defaults[t],r),r.add&&(e('<div class="'+o.search+'" />').prependTo(this.$menu).append('<input placeholder="'+r.placeholder+'" type="text" autocomplete="off" />'),r.noResults&&e("ul, ol",this.$menu).first().append('<li class="'+o.noresults+'">'+r.noResults+"</li>")),e("div."+o.search,this.$menu).length&&this.$menu.addClass(o.hassearch),r.search){var i=e("div."+o.search,this.$menu).find("input");if(i.length){var u=e("."+o.panel,this.$menu),h=e("."+o.list+"> li."+o.label,this.$menu),c=e("."+o.list+"> li",this.$menu).not("."+o.subtitle).not("."+o.label).not("."+o.noresults),f="> a";r.showLinksOnly||(f+=", > span"),i.off(d.keyup+" "+d.change).on(d.keyup,function(e){s(e.keyCode)||a.$menu.trigger(d.search)}).on(d.change,function(){a.$menu.trigger(d.search)}),this.$menu.off(d.reset+" "+d.search).on(d.reset+" "+d.search,function(e){e.stopPropagation()}).on(d.reset,function(){a.$menu.trigger(d.search,[""])}).on(d.search,function(s,n){"string"==typeof n?i.val(n):n=i.val(),n=n.toLowerCase(),u.scrollTop(0),c.add(h).addClass(o.hidden),c.each(function(){var s=e(this);e(f,s).text().toLowerCase().indexOf(n)>-1&&s.add(s.prevAll("."+o.label).first()).removeClass(o.hidden)}),e(u.get().reverse()).each(function(){var s=e(this),n=s.data(l.parent);if(n){var t=s.add(s.find("> ."+o.list)).find("> li").not("."+o.subtitle).not("."+o.label).not("."+o.hidden);t.length?n.removeClass(o.hidden).removeClass(o.nosubresults).prevAll("."+o.label).first().removeClass(o.hidden):(s.hasClass(o.current)&&n.trigger(d.open),n.addClass(o.nosubresults))}}),a.$menu[c.not("."+o.hidden).length?"removeClass":"addClass"](o.noresults),a.$menu.trigger(d.update)})}}},e[n].defaults[t]={add:!1,search:!1,showLinksOnly:!0,placeholder:"Search",noResults:"No results found."},e[n].addons=e[n].addons||[],e[n].addons.push(t)}(jQuery);