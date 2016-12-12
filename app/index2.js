var title, pages = [],
	gotPages, updaterId;
var fs = require('fs-extra');
var cheerio = require('cheerio');
var request = require('request');
var progress = require('request-progress');

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

	if (gotPages == 3) {
		var imageRoom = Math.max(2 - pages.filter(p => p.done != 1 && p.bussy).length, 0)
		var imageNeeded = pages.filter(p => p.done != 1 && !p.bussy).slice(0, imageRoom);
		for (var p of imageNeeded) getImage(p);
	}
	var gotAllImages = pages.filter(p => p.done != 1) == 0;

	if (gotPages == 2) countPages();
	if (gotPages == 3 && gotAllLinks && gotAllImages) clearInterval(updaterId);

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
		var $ = cheerio.load(p);

		$("a[href^='http://snafu-comics.com/swmcomic/']").each(function(i, elem) {
			pages.push({
				url: $(this).attr("href"),
				title: $(this).attr("href").replace("http://snafu-comics.com/swmcomic/", "").replace("/", ""),
				image: null,
				bussy: false,
				done: 0,
			})
		});
		if ($("link[rel='next']").get().length == 1) {
			console.log("got page " + n);
			getPages(n + 1)
		} else {
			gotPages = 2;
		}
	})
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

function getImage(p) {
	set(p.title, "bussy", true);
	get({url: p.image,encoding: 'binary'}, function(pr) {
    set(p.title, "done", pr.percent);
  }, function(r) {
    var dir = (process.env.HOME || process.env.USERPROFILE) + "/Pictures/SNAFU/" + title + "/";
    fs.ensureDir(dir);
		fs.writeFile(dir + p.number + " - " + p.title + ".jpg", r, 'binary', function(err) {
			if (err)
				console.log(err);
			else
				console.log("The file was saved!");
		});
    set(p.title, "done", 1);
		set(p.title, "bussy", false);
	});
}

function get(url, update, done) {
	progress(request.get(url, function(error, response, body) {
		if (!error && response.statusCode == 200) {
			done && done(body);
		}
	})).on('progress', function(state) {
		// The state is an object that looks like this:
		// {
		//     percent: 0.5,               // Overall percent (between 0 to 1)
		//     speed: 554732,              // The download speed in bytes/sec
		//     size: {
		//         total: 90044871,        // The total payload size in bytes
		//         transferred: 27610959   // The transferred payload size in bytes
		//     },
		//     time: {
		//         elapsed: 36.235,        // The total elapsed seconds since the start (3 decimals)
		//         remaining: 81.403       // The remaining seconds to finish (3 decimals)
		//     }
		// }
		update && update(state);
	}).on('error', function(err) {
		console.log(err);
	})
}
