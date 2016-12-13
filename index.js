var title, pages = [],
	gotPages, updaterId;
// var fs = require('fs-extra');
// var request = require('request');
// var progress = require('request-progress');

function init() {
	document.querySelector('input').onkeypress = function(e) {
		if (!e) e = window.event;
		var keyCode = e.keyCode;
		if (keyCode == '13') {
			// Enter pressed
			console.log("Starting to download:", this.value);
			title = this.value;
			pages = [];
			gotPages = 0;
			updaterId = setInterval(updater, 100);
		}
	}

	addStorage(0,function() {
		filer.mkdir("images",false, function() {
			clear("/images/")
			console.log("ready");
		})
	})
}
window.addEventListener("load", init)

function set(t, key, value) {
	for (var i of pages)
		if (i.title == t) i[key] = value;
}

function updater() {
	if (gotPages == 0) getPages(1);

	var linkRoom = Math.max(8 - pages.filter(p => !p.image && p.bussy).length, 0)
	var linkNeeded = pages.filter(p => !p.image && !p.bussy).slice(0, linkRoom);
	var gotAllLinks = pages.filter(p => !p.image) == 0;
	for (var p of linkNeeded) getLink(p);

	if (gotPages == 2) countPages();
	if (gotPages == 2 || gotPages == 3) {
		var imageRoom = Math.max(8 - pages.filter(p => p.done != 1 && p.bussy).length, 0)
		var imageNeeded = pages.filter(p => p.done != 1 && !p.bussy && p.image).slice(0, imageRoom);
		for (var p of imageNeeded) getImage(p);
	}
	var gotAllImages = pages.filter(p => p.done != 1) == 0;

	if (gotPages == 3 && gotAllLinks && gotAllImages) {
		clearInterval(updaterId);
		console.log("done downloading");
		generateZip()
	}

	var c = document.querySelector(".links");
	for (var i of pages) {
		var ell = document.getElementById(i.title);

		if (!ell) {
			ell = document.createElement("div");
			ell.id = i.title;
			ell.innerHTML = "<b style=\"float: left\">" + i.title + ":</b><div style=\"float: right\"><progress max=\"100\"></progress></div><br>"
			c.appendChild(ell);
		}

		if (i.bussy && !i.image) {
			ell.querySelector("progress").removeAttribute("value");
		} else {
			ell.querySelector("progress").setAttribute("value", i.done * 100);
		}
	}
}

function getPages(n) {
	gotPages = 1;

	get("http://snafu-comics.com/swmseries/" + title + "/page/" + n, null, function(p) {
			var parser = new DOMParser();
	    var doc = parser.parseFromString(p, "text/html");

			 doc.querySelectorAll("a[href^='http://snafu-comics.com/swmcomic/']").forEach(e => {
				 pages.push({
	 				url: e.getAttribute("href"),
	 				title: e.getAttribute("href").replace("http://snafu-comics.com/swmcomic/", "").replace("/", ""),
	 				image: null,
	 				bussy: false,
	 				done: 0,
	 			})
			 })

		if (doc.querySelectorAll("link[rel='next']").length != 0) {
			console.log("got page " + n);
			getPages(n + 1)
		} else {
			gotPages = 2;
		}
	})
}

function generateZip() {
	var zip = new JSZip();
	filer.ls('/images/', function(entries) {
		var num = entries.length,
			done = 0;
		entries.forEach(function(i) {
			filer.open(i.fullPath, function(file) {
				var reader = new FileReader();
				reader.onload = function(e) {
					console.log(reader);
					zip.file(i.name, reader.result);
					done++;
					if (done == num) {
						zip.generateAsync({type: "blob"}).then(function(blob) {
								filer.write("/" + title + ".zip", {data: blob,type: blob.type}, function(fileEntry, fileWriter) {
									console.log("done");
									var a = document.createElement('a');
									a.setAttribute('href', fileEntry.toURL());
									a.setAttribute('download', title + '.zip');
									a.click();
								}, err => console.log(err));
							});
					}
				}
				reader.readAsArrayBuffer(file);
			}, err => console.log(err));
		});
	}, err => console.log(err));
}

function countPages() {
	for (var i = pages.length - 1, x = 1; i >= 0; i--, x++) pages[i].number = x;
	gotPages = 3;
}

function getLink(p) {
	set(p.title, "bussy", true);
	get("http://snafu-comics.com/wp-json/oembed/1.0/embed?url=" + p.url, null, function(r) {
		var json = JSON.parse(r);
		if (!json.thumbnail_url) return pages = pages.filter(a => a.title != p.title);
		set(p.title, "image", json.thumbnail_url);
		set(p.title, "bussy", false);
	});
}

var filer = new Filer();
var systemStorage = 32;
function addStorage(size, _cb) {
	systemStorage += size;
	filer.init({
		persistent: false,
		size: systemStorage
	}, function(fs) {
			_cb&&_cb(fs)
	}, err => console.log(err));
}

function find(name,_cb) {
	filer.ls('/images/', function(entries) {
  for (var i of entries) if (i.name == name) return _cb&&_cb(i);
	_cb&&_cb(null);
	}, err => console.log(err));
}

function clear(path) {
	filer.ls(path || "/",dir => dir.forEach(path => filer.rm(path.fullPath,a => console.log(a),a => console.log(a))),a => console.log(a))
}

function getImage(p) {
	set(p.title, "bussy", true);
	if (!filer.isOpen) filer.init({}, n); else n();

	function n() {
		find(p.number + " - " + p.title + ".jpg", function(found) {
				if (found) {
					set(p.title, "done", 1);
					set(p.title, "bussy", false);
				} else {
					get(p.image, function(pr) {
						set(p.title, "done", pr.percent);
					}, function(r) {
						addStorage(r.size, function() {
							filer.write("/images/" + p.number + " - " + p.title + ".jpg", {data: r,type: r.type}, function(fileEntry, fileWriter) {
								// console.log(fileEntry, fileWriter);
								set(p.title, "done", 1);
								set(p.title, "bussy", false);
							}, err => console.log(err));
						})
					}, true);
				}
		})
	}
}

function get(url, update, done, bin) {
	var xhr = new XMLHttpRequest();
	if (bin) xhr.responseType = "blob";
	xhr.addEventListener("readystatechange", function() {
		if (this.readyState === 4) {
			if (this.status == 200) {
				done && done(bin ? this.response : this.responseText);
			} else {
				console.log("does not exists");
			}
		}
	});

	xhr.addEventListener("progress", function(evt) {
		if (evt.lengthComputable) { //evt.loaded the bytes browser receive
			                          //evt.total the total bytes seted by the header
			update && update({
				percent: evt.loaded / evt.total
			});
		}
	});

	xhr.open("GET", url);
	xhr.send();
}
//
// function getOld(url, update, done) {
// 	progress(request.get(url, function(error, response, body) {
// 		if (!error && response.statusCode == 200) {
// 			done && done(body);
// 		}
// 	})).on('progress', function(state) {
// 		// The state is an object that looks like this:
// 		// {
// 		//     percent: 0.5,               // Overall percent (between 0 to 1)
// 		//     speed: 554732,              // The download speed in bytes/sec
// 		//     size: {
// 		//         total: 90044871,        // The total payload size in bytes
// 		//         transferred: 27610959   // The transferred payload size in bytes
// 		//     },
// 		//     time: {
// 		//         elapsed: 36.235,        // The total elapsed seconds since the start (3 decimals)
// 		//         remaining: 81.403       // The remaining seconds to finish (3 decimals)
// 		//     }
// 		// }
// 		update && update(state);
// 	}).on('error', function(err) {
// 		console.log(err);
// 	})
// }
