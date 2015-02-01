/*******************************************************************************

	Gootix.net Front-End Framework
	Title: Engzell.me
	Author: Sergios Singeridis
	Date: March 2014

*******************************************************************************/

(function($) {

	var App = {

		/**
		 * Init Function
		 */
		init: function() {
			App.headerSize();
			App.menuPanel();
			App.progressButtons();
			App.testimonialSlider();
			App.smoothScroll();
		},
		
		/**
		 * Header Size
		 */
		headerSize: function() {
			function headersize(){

				var e=jQuery(window).height(), 
					t=jQuery("#intro").height();

				jQuery("#header").css("height", function(){
					return e
				});

				jQuery("#intro").css("padding-top", function(){
					return e/2-t/2-50+"px"
				});
			}

			jQuery(window).load(function(){
				headersize();
			});

			jQuery(window).resize(function(){
				headersize()
			});

			$("form .progress-button").click(function() {
				window.location = 'http://engzell.me/pdf_server.php?file=alexander-engzell-cv-2014.pdf';
			});
		},

		/**
		 * Menu Panel
		 */
		menuPanel: function() {
			var $menu = $('#navigation'),
				$html = $('html, body');

			$menu.mmenu({
				position 		: "right",
				zposition 		: "front",
				modal 			: false
			});

			$menu.find( 'li > a' ).on( 'click', function() {
				var href = $(this).attr( 'href' );

				//	if the clicked link is linked to an anchor, scroll the page to that anchor 
				if ( href.slice( 0, 1 ) == '#' ) {
					$menu.one( 'closed.mm', function() {
						setTimeout(
							function() {
								$html.animate({
									scrollTop: $( href ).offset().top
								});	
							}, 10
						);
					});
				}
			});
		},

		/**
		 * Progress Buttons
		 */
		progressButtons: function() {
			[].slice.call( document.querySelectorAll( 'button.progress-button' ) ).forEach( function( bttn ) {
				new ProgressButton( bttn, {
					callback : function( instance ) {
						var progress = 0,

						interval = setInterval( function() {
							progress = Math.min( progress + Math.random() * 0.1, 1 );
							instance._setProgress( progress );

							if( progress === 1 ) {
								instance._stop(1);
								clearInterval( interval );
							}
						}, 200 );
					}
				} );
			} );
		},

		/**
		 * Testimonial Slider
		 */
		testimonialSlider: function() {
			$('.banner').unslider({
				speed: 500,               //  The speed to animate each slide (in milliseconds)
				delay: 3000,              //  The delay between slide animations (in milliseconds)
				complete: function() {},  //  A function that gets called after every slide animation
				keys: true,               //  Enable keyboard (left, right) arrow shortcuts
				dots: true,               //  Display dot navigation
				fluid: true              //  Support responsive design. May break non-responsive designs
			});
		},

		/**
		 * Smooth Scroll
		 */
		smoothScroll: function() {
			$(function() {
				$('a[href*=#]:not([href=#])').click(function() {
					if (location.pathname.replace(/^\//,'') == this.pathname.replace(/^\//,'') && location.hostname == this.hostname) {
						var target = $(this.hash);
						target = target.length ? target : $('[name=' + this.hash.slice(1) +']');
						if (target.length) {
							$('html,body').animate({
								scrollTop: target.offset().top
							}, 1000);
							return false;
						}
					}
				});
			});
		}
	}
	
	$(function() {
		App.init();
	});

})(jQuery);