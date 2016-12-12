var title = "powerpuffgirls"

var request = require('request');
var cheerio = require('cheerio');

var urls = [];

function getPages(page) {
	request("http://snafu-comics.com/swmseries/" + title + "/page/" + page, function(error, response, html) {
		if (error) return _cb && _cb(error);

		var $ = cheerio.load(html);

		$("a[href^='http://snafu-comics.com/swmcomic/']").each(function(i, elem) {
			urls.push($(this).attr("href"));
		});
		if ($("link[rel='next']").get().length == 1) {
      console.log("got page " + page);
			getPages(page + 1)
		} else {
			checkDone();
		}
	});
}

var images = [], b = 0, bmax = 8;
function getImagesUrls() {
  if (urls.length <= 0) {
    return;
  }
  var url = urls.pop();
  request("http://snafu-comics.com/wp-json/oembed/1.0/embed?url=" + url, function(error, response, html) {
    var json = JSON.parse(html);
    if (!json.thumbnail_url) console.log("--->", "http://snafu-comics.com/wp-json/oembed/1.0/embed?url=" + url); else images.push(json.thumbnail_url);
    console.log("got iamge url " + images.length)
    b--;
    checkDone();
  });
}
function checkDone() {
  if (urls.length <= 0) {
    if (b == 0) console.log(images);
    return;
  }
  while (b < bmax) {
    b++;
    getImagesUrls();
  }
}

getPages(1)

// Array.from(document.querySelectorAll("a[href^='http://snafu-comics.com/swmcomic/']")).map(function(a) {return a.href})
