function init() {
	document.querySelector('input').onkeypress = function(e) {
		if (!e) e = window.event;
		var keyCode = e.keyCode;
		if (keyCode == '13') {
			// Enter pressed
			console.log(this.value);
      title = this.value;
      urls = [];
      getPages(1);
		}
	}
}

var cheerio = require('cheerio');

var urls = [], title;

function getPages(page) {
  var xhr = new XMLHttpRequest();

  xhr.addEventListener("readystatechange", function () {
    if (this.readyState === 4) {
      if (this.status == 200) {
        var $ = cheerio.load(this.responseText);

        $("a[href^='http://snafu-comics.com/swmcomic/']").each(function(i, elem) {
          urls.push({
            url: $(this).attr("href"),
            title: $(this).attr("href").replace("http://snafu-comics.com/swmcomic/","").replace("/",""),
            image: null,
            isDownloading:true,
            done:0,
            speed:0,
            check:0
          })
        });
        if ($("link[rel='next']").get().length == 1) {
          console.log("got page " + page);
          updateUser()
          getPages(page + 1)
        } else {
          checkDone()
        }
      } else {
        console.log("does not exists");
      }
    }
  });

  xhr.open("GET", "http://snafu-comics.com/swmseries/" + title + "/page/" + page);

  xhr.send();
}

var images = [], b = 0, bmax = 16;
function getImagesUrls(url) {
  url.isDownloading = false;
  console.log(url);
  updateUser();
  var xhr = new XMLHttpRequest();

  xhr.addEventListener("readystatechange", function () {
    if (this.readyState === 4) {
      if (this.status == 200) {
        var json = JSON.parse(this.responseText);
        if (!json.thumbnail_url) console.log("--->", "http://snafu-comics.com/wp-json/oembed/1.0/embed?url=" + url); else url.image = json.thumbnail_url;
        url.isDownloading = true;
        updateUser();
        b--;
        checkDone();
      } else {
        console.log("does not exists");
      }
    }
  });

  xhr.open("GET","http://snafu-comics.com/wp-json/oembed/1.0/embed?url=" + url.url);

  xhr.send();
}
function checkDone() {
  while (b < bmax) {
    b++;
    var n = getNext(0);
    if (!n) {
      if (urls.filter(a => !a.isDownloading).length == 0) {
        console.log("done");
        checkDone2();
      }
      return;
    }
    getImagesUrls(n);
  }
}
function getNext(n) {
  for (var i of urls) if (i.check == n) {
    i.check++;
    return i;
  }
  return null;
}

function updateUser() {
var c = document.querySelector(".links");
  for (var i of urls) {
    var ell = document.getElementById(i.title);

    if (!ell) {
      ell = document.createElement("div");
      ell.id = i.title;
      ell.innerHTML = "<b style=\"float: left\">" + i.title + ":</b><div style=\"float: right\"><progress max=\"100\"></progress></div><br>"
      c.appendChild(ell);
    }

    if (i.isDownloading) {
      ell.querySelector("progress").setAttribute("value",i.done);
    } else {
      ell.querySelector("progress").removeAttribute("value");
    }
  }
}
function htmlToElement(html) {
    var template = document.createElement('template');
    template.innerHTML = html;
    return template.content.firstChild;
}

var http = require('http'),
    Stream = require('stream').Transform,
    fs = require('fs'), x = 1;
function downloadImage(url) {
  http.request(url.image, function(response) {
    var len = parseInt(response.headers['content-length'], 10);
    var cur = 0;
    var data = new Stream();

    response.on('data', function(chunk) {
      data.push(chunk);
      cur += chunk.length;
      url.done = (100.0 * cur / len).toFixed(2);
      updateUser()
    });

    response.on('end', function() {
      fs.writeFileSync('./images/' + x + url.title + '.jpg', data.read());
      b1--;
      x++;
      checkDone2()
    });
  }).end();
};
var b1 = 0, bmax1 = 2;
function checkDone2() {
  while (b1 < bmax1) {
    b1++;
    var n = getNext(1);
    if (!n) {
      return;
    }
    downloadImage(n);
  }
}
window.addEventListener("load",init)
