// ==UserScript==
// @id             iitc-plugin-comm-filter@udnp
// @name           IITC plugin: COMM Filter
// @category       COMM
// @version        0.0.1.@@DATETIMEVERSION@@
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @updateURL      @@UPDATEURL@@
// @downloadURL    @@DOWNLOADURL@@
// @description    [@@BUILDNAME@@-@@BUILDDATE@@] COMM Filter
// @include        https://www.ingress.com/intel*
// @include        http://www.ingress.com/intel*
// @match          https://www.ingress.com/intel*
// @match          http://www.ingress.com/intel*
// @include        https://www.ingress.com/mission/*
// @include        http://www.ingress.com/mission/*
// @match          https://www.ingress.com/mission/*
// @match          http://www.ingress.com/mission/*
// @grant          none
// ==/UserScript==

@@PLUGINSTART@@

// PLUGIN START ////////////////////////////////////////////////////////

// use own namespace for plugin
window.plugin.commfilter = (function() {
  var ID = 'PLUGIN_COMM_FILTER',
      DESCRIPTIONS = "COMM Filter plug-in",
      dom = null,
      comm = { //TODO change this to singleton
        dom: null,
        channels: {}, // all, faction, alerts
        Channel: function(name) {
          return {
            name: name,
            dom: null,
            hasLogs: function() {
              if(this.dom && this.dom.querySelector('table')) {
                return true;
              } else {
                return false;
              }
            }
          };
        },
        create: function() {
          var dom = document.getElementById('chat');
          if(!dom) return null;
          
          var channels = [new comm.Channel('all'), new comm.Channel('faction'), new comm.Channel('alerts')];
          
          for(var i = 0; i < channels.length; i++) {
            channels[i].dom = dom.querySelector('#chat' + channels[i].name);
            
            if(channels[i].dom) {
              comm.insertStatusViewTo(channels[i].dom);
            }
            
            comm.channels[channels[i].name] = channels[i];
          }
          
          comm.dom = dom;
          
          // filtering by agent name clicked/tapped in COMM       
          dom.addEventListener('click', function(){
            if(!event.target.classList.contains('nickname')) return;
            
            // tentative: to avoid a problem on Android that causes cached chat logs reset,
            //            call event.stopImmediatePropagation() in this.
            //            So IITC default action that inputs @agentname automatically 
            //            to the #chattext box is blocked.
            event.stopImmediatePropagation()

            var channel = window.chat.getActive();
            
            if(comm.channels[channel].hasLogs()) {
              input.dom.value = event.target.textContent;
              renderLogs(channel);
            }
          });
          
          document.getElementById('chatcontrols').addEventListener('click', function() {
            if(comm.checkChannelTab(event.target)) {
              var channel = window.chat.getActive();
              if(comm.channels[channel].hasLogs()) renderLogs(channel);
            }
          });
          
          return comm;
        },
        insertStatusViewTo: function(channelDom) {
          var dom = document.createElement('div');
          dom.className = 'status';
          channelDom.insertBefore(dom, channelDom.firstChildElement);
        },
        checkChannelTab: function(tab) {
          if(tab.tagName.toLowerCase() === 'a' && tab.childElementCount === 0) return true;
          else return false;
        }
      },
      input = {
        oldValue: null,
        dom: null,
        create: function() {
          var dom = document.createElement('input');
          dom.type = 'text';
          dom.name = 'agent';
          dom.defaultValue = '';
          dom.placeholder = 'agent name';
          dom.addEventListener('keyup', function() {
            var channel = window.chat.getActive();
            
            if(this.isChanged() && comm.channels[channel].hasLogs()) {
              renderLogs(channel);
            }
          }.bind(this));
          
          this.dom = dom;
          return this;
        },
        isChanged: function(){
          if(this.dom && this.dom.value !== this.oldValue){
            this.oldValue = this.dom.value; 
            return true;
          }
          else return false;
        }
      },
      reset = {
        dom: null,
        create: function() {
          var dom = document.createElement('button');
          dom.type = 'reset';
          dom.textContent = 'X';
          
          this.dom = dom;
          return this;
        }
      };
  
  //// based on original iitc/code/chat.js @ rev.5298c98
  // renders data from the data-hash to the element defined by the given
  // ID. Set 3rd argument to true if it is likely that old data has been
  // added. Latter is only required for scrolling.
  var renderData = function(data, element, likelyWereOldMsgs) {
    var elm = $('#'+element);
    if(elm.is(':hidden')) return;

    // discard guids and sort old to new
  //TODO? stable sort, to preserve server message ordering? or sort by GUID if timestamps equal?
    var vals = $.map(data, function(v, k) { return [v]; });
    vals = vals.sort(function(a, b) { return a[0]-b[0]; });

    // render to string with date separators inserted
    var msgs = '';
    var prevTime = null;
    $.each(vals, function(ind, msg) {
      var nextTime = new Date(msg[0]).toLocaleDateString();
      if(prevTime && prevTime !== nextTime)
        msgs += chat.renderDivider(nextTime);
      msgs += msg[2];
      prevTime = nextTime;
    });

    var scrollBefore = scrollBottom(elm);
    //elm.html('<table>' + msgs + '</table>');
    elm.append(renderTableDom($(msgs)));
    chat.keepScrollPosition(elm, scrollBefore, likelyWereOldMsgs);
  }
  
  //// based on original iitc/code/chat.js @ rev.5298c98
  // contains the logic to keep the correct scroll position.
  var keepScrollPosition = function(box, scrollBefore, isOldMsgs) {
    // If scrolled down completely, keep it that way so new messages can
    // be seen easily. If scrolled up, only need to fix scroll position
    // when old messages are added. New messages added at the bottom don’t
    // change the view and enabling this would make the chat scroll down
    // for every added message, even if the user wants to read old stuff.

    if(box.is(':hidden') && !isOldMsgs) {
      box.data('needsScrollTop', 99999999);
      return;
    }

    var logsTable = $('table', box);
    // box[0].offsetHeight - logsTable[0].offsetHeight
    var offset = box.outerHeight() - logsTable.outerHeight();

    if(offset > 0) {
      logsTable.css('margin-bottom', offset + 'px');
    }

    var statusView = $('.status', box); 
    statusView.text('');

    if(scrollBefore === 0 || isOldMsgs) {
      box.data('ignoreNextScroll', true);
      box.scrollTop(box.scrollTop() + (scrollBottom(box)-scrollBefore)
        + statusView.outerHeight());
      statusView.text('Now loading...');
    }
  }

  function renderTableDom(rowDoms) {
    var dF = document.createDocumentFragment();

    for(var i = 0; i < rowDoms.length; i++) {
      filter(rowDoms[i]);
      dF.appendChild(rowDoms[i]);
    }
    
    var oldTableDom = document.querySelector('#chat' + window.chat.getActive() + ' table'); 
    if(oldTableDom) {
      oldTableDom.parentElement.removeChild(oldTableDom);
      oldTableDom = null;
    }
    
    var tableDom = document.createElement('table'); 
    tableDom.appendChild(dF);
    
    return tableDom;
  }
  
  //// based on original iitc/code/chat.js @ rev.5298c98
  function renderDivider(text) {
    return '<tr class="divider"><td colspan="3"><summary>' + text + '</summary></td></tr>';
  }

  function filter(logRowDom) {
    if(input.dom) filterAgent(logRowDom, input.dom.value);
  }
  
  function filterAgent(logRowDom, s) {
    var agentDom = logRowDom.querySelector('.nickname'); 
    if(!agentDom) return;
    
    if(agentDom.textContent.toLowerCase().search(s.toLowerCase()) !== 0) {
      logRowDom.hidden = true;
    } else {
      logRowDom.hidden = false;
    }
  }
  
  function renderLogs(channel) {
    switch(channel) {
      case 'all':
        window.chat.renderPublic(false);
        break;
        
      case 'faction':
        window.chat.renderFaction(false);
        break;
        
      case 'alerts':
        window.chat.renderAlerts(false);
        break;
        
      default:
        break;
    }
  }
  
  function clear() {
    input.dom.value = input.dom.defaultValue;
    input.oldValue = input.dom.value;
    
    var channel = window.chat.getActive();
    
    if(comm.channels[channel].hasLogs()) renderLogs(channel);
    
    document.getElementById('chattext').value = '';
  }

  function setup() {
    if(!comm.create()) return;
        
    // override original functions following:
    window.chat.renderData = renderData;
    window.chat.renderDivider = renderDivider;
    window.chat.keepScrollPosition = keepScrollPosition;
    
    dom = document.createElement('form');
    dom.id = ID;
    dom.addEventListener('reset', clear);

    input.create();
    dom.appendChild(input.dom);
    
    reset.create();
    dom.appendChild(reset.dom);
    
    comm.dom.insertBefore(dom, comm.dom.firstElementChild);
  }

  return {
    setup: setup
  };

}());

var setup = (function(plugin) {
  return function(){
    plugin.setup();
      
    $("<style>")
      .prop("type", "text/css")
      .html("@@INCLUDESTRING:plugins/comm-filter.css@@")
      .appendTo("head");
  };
}(window.plugin.commfilter));

// PLUGIN END //////////////////////////////////////////////////////////

@@PLUGINEND@@
