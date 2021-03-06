var port = chrome.runtime.connect();

chrome.runtime.sendMessage({action: 'isBlacklisted', url:document.URL});
chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
    isBlacklisted = request.response // set global
    if (request.method == 'isBlacklisted' && request.response == false){
      scanPage();
    } else {
      // this page is blacklisted. Don't scan.
    }
});

var numberOfHighlightedAddresses = 3;

var accumulator = [];

var matchText = function(node, regex, callback, excludeElements) {

    excludeElements || (excludeElements = [
        'script',
        'style',
        'iframe',
        'cavas'
    ] );

    var child = node.firstChild;

    do {
        if (!child) { break }
        switch (child.nodeType) {
        case 1:
            if (excludeElements.indexOf(child.tagName.toLowerCase()) > -1) {
                continue;
            }
            matchText( child, regex, callback, excludeElements );
            break;
        case 3:
           match = child.data.match(regex);
           if (match !== null){
                accumulator = accumulator.concat(match);
                // Some pages a filled with bitcoin addresses
                // These are not useful to us.
                if(accumulator.length >= numberOfHighlightedAddresses){ return }
           }
           child.data.replace(regex, function (all) {
                var args = [].slice.call(arguments),
                    offset = args[args.length - 2],
                    newTextNode = child.splitText(offset);

                newTextNode.data = newTextNode.data.substr(all.length);
                callback.apply(window, [child].concat(args));
                child = newTextNode;
            });
          break;
        }
    } while (child = child.nextSibling);

    return node;
}

// TODO search links for bitcoin addresses
// function searchLinksForBitcoin(){
//     var accumulator = [];
//     bitcoinTagRegexp = /bitcoin:([13][1-9A-HJ-NP-Za-km-z]{26,33})\?&?amount=[0-9\.]+/g;
//     $.each(document.links, function(key, value) {
//         if (value.href.match(bitcoinTagRegexp)) {
//             accumulator.push(value.href)
//         }
//     });
//     return accumulator;
// }
//
// function stripBitcoinAddresssesFromBitcoinLinks(accumulator){
//     if (accumulator.length) { accumulator = [] }
//     $.each(searchLinksForBitcoin(), function (value) {
//         match = value.match(/[13][a-km-zA-HJ-NP-Z0-9]{26,33}/)
//         if (match.length > 0) {
//             accumulator.push(match);
//         }
//     } );
//     return accumulator;
// }



window.addEventListener("message", function (event) {
    // We only accept messages from ourselves
    if (event.source != window) {
        return;
    }

    var highlight = document.getElementById(event.data.bitcoinAddress);
    highlight.style.backgroundColor = '';
    chrome.runtime.sendMessage({
        action: event.data.action,
        bitcoinAddress: event.data.bitcoinAddress,
        url: document.URL
     } );
}, false);

function scanPage(){
  if(document.URL.match(/http/)){ // only send http or https urls no chrome:// type addresses.
    matchText(document.documentElement, new RegExp("(^|\\s)[13][a-km-zA-HJ-NP-Z0-9]{26,33}($|\\s)", "g"), function (node, match, offset) {

        checkbox = document.createElement("input");
        checkbox.type = 'checkbox';
        checkbox.checked = 'checked';
        checkbox.addEventListener("click",
          function () {
            window.postMessage({ action: "revokeBitcoinAddress", bitcoinAddress: match }, "*");
          }, false);

        var span = document.createElement("span");
        span.style.backgroundColor = '#7FE56F';  //'#5ada46';
        span.style.padding = '0px';
        span.style.borderRadius = '2px';
        span.style.display = 'inline-flex';
        span.textContent = match;
        span.id = match;

        // Checkbox after the BTC address.
        //node.parentNode.insertBefore(span, node.nextSibling).appendChild(checkbox);

        // Checkbox after the BTC address.
        node.parentNode.insertBefore(span, node.nextSibling);
        node.nextSibling.insertBefore(checkbox, node.nextSibling.firstChild);
    });

    if (accumulator.length > 0) {
      for(i in accumulator){ accumulator[i] = accumulator[i].trim() } // clean the addresses a little...
      chrome.runtime.sendMessage({
          bitcoinAddresses: accumulator.slice(0,numberOfHighlightedAddresses -1),
          bitcoinAddress: accumulator[0],
          title: document.title,
          url: document.URL,
          timestamp: Date.now()
      });
    }
  }
}

