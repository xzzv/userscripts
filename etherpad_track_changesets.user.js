// ==UserScript==
// @name           EtherpadTrackChangesets
// @description    EtherpadTrackChangesets
// @version        0.2 dev
// @grant          none
// @include        http://piratenpad.de/*
// @include        http://*.piratenpad.de/*
// @include        https://piratenpad.de/*
// @include        https://*.piratenpad.de/*
// @include        http://piratepad.net/*
// @include        http://*.piratepad.net/*
// @include        http://titanpad.com/*
// @include        http://*.titanpad.com/*
// @include        https://etherpad.mozilla.org/*
// @include        https://*.etherpad.mozilla.org/*
// @include        http://*ponypad*.*/*
// ==/UserScript==

(function() {
    if(!document.querySelector || !document.querySelector('#padpage #padmain #editorcontainer'))
        return;
    var isChrome = navigator.userAgent.toLowerCase().indexOf('chrome')>=0;
    if(isChrome) {
        var script = document.createElement('script');
        script.setAttribute('type','text/javascript');
        script.textContent = '('+executeScript.toString()+')();';
        document.head.appendChild(script);
    }
    else
        executeScript();
    
    function executeScript() {
        if(!window.clientVars || !window.pad || !window.padeditor)
            return;

        var allUserInfos = {};
        var clientHistoricalAuthorData = window.clientVars.collab_client_vars.historicalAuthorData;
        for(var user in clientHistoricalAuthorData)
            allUserInfos[user] = clientHistoricalAuthorData[user];

        var oldHandleUserJoin = window.pad.handleUserJoin;
        window.pad.handleUserJoin = handleUserJoin;
        if(window.pad.collabClient)
            window.pad.collabClient.setOnUserJoin(handleUserJoin);

        var oldhandleUserUpdate = window.pad.handleUserUpdate;
        window.pad.handleUserUpdate = handleUserUpdate;
        if(window.pad.collabClient)
            window.pad.collabClient.setOnUpdateUserInfo(handleUserUpdate);
        
        var oldApplyChangesToBase = window.padeditor.ace.applyChangesToBase;
        window.padeditor.ace.applyChangesToBase = applyChangesToBase;

        function handleUserJoin(msg) {
            oldHandleUserJoin(msg);
            allUserInfos[msg.userId] = msg;
        }

        function handleUserUpdate(msg) {
            oldhandleUserUpdate(msg);
            allUserInfos[msg.userId] = msg;
        }

        function applyChangesToBase(changeset, author, pool) {
            var apool = new Easysync2.AttribPool(pool);
            oldApplyChangesToBase(changeset, author, pool); 
            try {
                logChanges(changeset, author, apool);
            }
            catch (e) {
                console.log('EtherpadTrackChangesets - Exception', e);
            }
        }

        function LogLineAssembler() {
            var logArgs = [''];

            this.append = function(text, styleOpen, styleClose) {
                if(styleOpen) {
                    logArgs[0] += '%c';
                    logArgs.push(styleOpen);
                }
                logArgs[0] += text;
                if(styleClose) {
                    logArgs[0] += '%c';
                    logArgs.push(styleClose);
                }
            }

            this.log = function() {
                console.log.apply(console, logArgs);
            }
        }
        
        function logChanges(changeset, author, apool) {
            var name = '{'+author+'}';
            if(allUserInfos[author] && allUserInfos[author].name) {
                name += ' '+allUserInfos[author].name;
            }
            
            var unpacked = Easysync2.Changeset.unpack(changeset);
            var csIter = Easysync2.Changeset.opIterator(unpacked.ops);
            var bankIter = Easysync2.Changeset.stringIterator(unpacked.charBank);
            var logLine = new LogLineAssembler();
            var isFirstOp = true;

            while (csIter.hasNext()) {
                var op = csIter.next();
                var attribStrings = [];
                Easysync2.Changeset.eachAttribNumber(op.attribs, function (num) {
                    var attrib = apool.getAttrib(num);
                    if (attrib[0] == 'author') {
                        if (attrib[1] == author) {
                            //attribStrings.push('*');
                        } 
                        else if (attrib[1] == '') {
                            attribStrings.push('white');
                        } 
                        else {
                            attribStrings.push(attrib[1]);
                        }
                    }
                    else if(attrib[1] == 'true') {
                        attribStrings.push('+' + attrib[0]);
                    }
                    else if(attrib[1] == 'false' || attrib[1] == '') {
                        attribStrings.push('-' + attrib[0]);
                    }
                    else {
                        attribStrings.push(attrib[0] + ': ' + attrib[1]);
                    }
                });
                var attribString = '(' + attribStrings.join(', ') + ')';
                if (attribString && !(op.opcode == '+' && attribString == '(*)') && !(op.opcode != '+' && attribString == '()')) {
                    logLine.append(attribString, 'background: white; color: gray;', 'color: black;');
                }
                if (isFirstOp) {
                    if (op.opcode == '=') {
                        var lineNumber = parseInt(op.lines);
                        if (window.lineRenumerator) {
                            if (lineNumber < lineRenumerator.getLinesOffset()) {
                                lineNumber = 'A' + (lineNumber + 1);
                            }
                            else {
                                lineNumber = parseInt(lineNumber) - lineRenumerator.getLinesOffset() + 1;
                            }
                        }
                        logLine.append('@' + lineNumber + ' ', 'background: white; color: gray;', 'color: black;');
                    }
                    else {
                        logLine.append('@0 ', 'background: white; color: gray;', 'color: black;');
                    }
                    logLine.append('    '+name+': ', 'background: white; color: gray;', 'color: black;');
                }
                
                if (op.opcode == '=' && isFirstOp) {
                }
                else if (op.opcode == '+') {
                    /*if (op.lines) {
                        logLine.append('+' + op.lines + '/', 'background: lightgray;');
                    }*/
                    logLine.append(bankIter.take(op.chars), 'background: palegreen;');
                }
                else if (op.opcode == '=') {
                    if (op.lines) {
                        logLine.append('=' + op.lines + '/' + op.chars, 'background: lightgray;', 'background: white;');
                    }
                    else {
                        logLine.append('=' + op.chars, 'background: lightgray;', 'background: white;');
                    }
                }
                else if (op.opcode == '-') {
                    if (op.lines) {
                        logLine.append('-' + op.lines + '/' + op.chars, 'background: salmon;', 'background: white;');
                    }
                    else {
                        logLine.append('-' + op.chars, 'background: salmon;', 'background: white;');
                    }
                }
                logLine.append(' ', 'background: white;');
                isFirstOp = false;
            }
            logLine.log();
        }
    }
})();
