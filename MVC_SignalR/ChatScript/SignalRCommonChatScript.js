
$(function () {
    clearInterval(refreshId);
    setScreen(false);

    // Declare a proxy to reference the hub.
    let chatHub = $.connection.chatHub;
    $.connection.hub.logging = true;

    registerClientMethods(chatHub);

    // Start Hub
    $.connection.hub.start().done(function () {
	    registerEvents(chatHub);
    });
});

// ------------------------------------------------------------------Variable ----------------------------------------------------------------------//
let loadMesgCount = 10;
let topPosition = 0;
let refreshId = null;

function scrollTop(ctrId) {
    let height = $('#' + ctrId).find('#divMessage')[0].scrollHeight;
    $('#' + ctrId).find('#divMessage').scrollTop(height);
}

// ------------------------------------------------------------------Start All Chat ----------------------------------------------------------------------//
function setScreen(isLogin) {
    if (!isLogin) {
        $("#divChat").hide();
    }
    else {
        $("#divChat").show();
    }
}

$('#profileImage').change(function () {
	//on change event  
	formdata = new FormData();
	if ($(this).prop('files').length > 0) {
		file = $(this).prop('files')[0];
		formdata.append("profileImage", file);
	}
});

function registerEvents(chatHub) {
    $("#btnStartChat").click(function () {
        let userName = $("#txtNickName").val(); let userEmail = $('#txtEmailId').val();  

        if (userName.length > 0 && userEmail.length > 0) {
            $('#hdEmailID').val(userEmail);
            chatHub.server.connect(userName, userEmail);
        }
        else {
            alert("Please enter your details");
        }
    });

    $("#txtNickName").keypress(function (e) {
        if (e.which == 13) {
            $("#btnStartChat").click();
        }
    });

    $("#txtMessage").keypress(function (e) {
        if (e.which == 13) {
            $('#btnSendMsg').click();
        }
    });

    $('#btnSendMsg').click(function () {
        let msg = $("#txtMessage").val();
        if (msg.length > 0) {
            let userName = $('#hdUserName').val();
            chatHub.server.sendMessageToAll(userName, msg);
            $("#txtMessage").val('');
        }
    });
}

function registerClientMethods(chatHub) {
    // Calls when user successfully logged in
    chatHub.client.onConnected = function (id, userName, allUsers, messages) {
        setScreen(true);

        $('#hdId').val(id);
        $('#hdUserName').val(userName);
        $('#spanUser').html(userName);

        // Add All Users
        for (i = 0; i < allUsers.length; i++) {
            AddUser(chatHub, allUsers[i].ConnectionId, allUsers[i].UserName, allUsers[i].EmailID);
        }

        // Add Existing Messages
        for (i = 0; i < messages.length; i++) {
            AddMessage(messages[i].UserName, messages[i].Message);
        }

        $('.login').css('display', 'none');
    }

    // On New User Connected
    chatHub.client.onNewUserConnected = function (id, name, email) {
        AddUser(chatHub, id, name, email);
    }

    // On User Disconnected
    chatHub.client.onUserDisconnected = function (id, userName) {
        $('#' + id).remove();

        let ctrId = 'private_' + id;
        $('#' + ctrId).remove();

        let disc = $('<div class="disconnect">"' + userName + '" logged off.</div>');

        $(disc).hide();
        $('#divusers').prepend(disc);
        $(disc).fadeIn(200).delay(2000).fadeOut(200);
    }

    // On User Disconnected Existing
    chatHub.client.onUserDisconnectedExisting = function (id, userName) {
        $('#' + id).remove();
        let ctrId = 'private_' + id;
        $('#' + ctrId).remove();
    }

    chatHub.client.messageReceived = function (userName, message) {
        AddMessage(userName, message);
    }

    chatHub.client.sendPrivateMessage = function (windowId, fromUserName, message, userEmail, email, status, fromUserId) {
        let ctrId = 'private_' + windowId;
        if (status == 'Click') {
            if ($('#' + ctrId).length == 0) {
                createPrivateChatWindow(chatHub, windowId, ctrId, fromUserName, userEmail, email);
                chatHub.server.getPrivateMessage(userEmail, email, loadMesgCount).done(function (msg) {
                    for (i = 0; i < msg.length; i++) {
                        $('#' + ctrId).find('#divMessage').append('<div class="message"><span class="userName">' + msg[i].UserName + '</span>: ' + msg[i].Message + '</div>');
                        // set scrollbar
                        scrollTop(ctrId);
                    }
                });
            }
            else {
                $('#' + ctrId).find('#divMessage').append('<div class="message"><span class="userName">' + fromUserName + '</span>: ' + message + '</div>');
                // set scrollbar
                scrollTop(ctrId);
            }
        }

        if (status == 'Type') {
            if (fromUserId == windowId)
                $('#' + ctrId).find('#msgTypingName').text('typing...');
        }
        else { $('#' + ctrId).find('#msgTypingName').text(''); }
    }
}

// Add User
function AddUser(chatHub, id, name, email) {
    let userId = $('#hdId').val();
    let userEmail = $('#hdEmailID').val();
    let code = "";

    if (userEmail == email && $('.loginUser').length == 0) {
        code = $('<div class="loginUser">' + name + "</div>");
    }
    else {
        code = $('<a id="' + id + '" class="user" >' + name + '<a>');
        $(code).click(function () {
            let id = $(this).attr('id');
            if (userEmail != email) {
                OpenPrivateChatWindow(chatHub, id, name, userEmail, email);
            }
        });
    }

    $("#divusers").append(code);
}

// Add Message
function AddMessage(userName, message) {
    $('#divChatWindow').append('<div class="message"><span class="userName">' + userName + '</span>: ' + message + '</div>');

    let height = $('#divChatWindow')[0].scrollHeight;
    $('#divChatWindow').scrollTop(height);
}
// ------------------------------------------------------------------End All Chat ----------------------------------------------------------------------//


// ------------------------------------------------------------------Start Private Chat ----------------------------------------------------------------------//
function OpenPrivateChatWindow(chatHub, id, userName, userEmail, email) {
    let ctrId = 'private_' + id;
    if ($('#' + ctrId).length > 0) return;

    createPrivateChatWindow(chatHub, id, ctrId, userName, userEmail, email);

    chatHub.server.getPrivateMessage(userEmail, email, loadMesgCount).done(function (msg) {
        for (i = 0; i < msg.length; i++) {
            $('#' + ctrId).find('#divMessage').append('<div class="message"><span class="userName">' + msg[i].UserName + '</span>: ' + msg[i].Message + '</div>');
            // set scrollbar
            scrollTop(ctrId);
        }
    });
}

function createPrivateChatWindow(chatHub, userId, ctrId, userName, userEmail, email) {

    let div = '<div id="' + ctrId + '" class="ui-widget-content draggable" rel="0"><div class="header"><div  style="float:right;"><img id="imgDelete" style="cursor:pointer; height:15px; width:15px;" src="/Images/delete.png"/></div><span class="selText" rel="0">' + userName + '</span><span class="selText" id="msgTypingName" rel="0"></span></div><div id="divMessage" class="messageArea"></div><div class="buttonBar"><input id="txtPrivateMessage" class="msgText" type="text" /><input id="btnSendMessage" class="submitButton button" type="button" value="Send" /></div><div id="scrollLength"></div></div>';

    let $div = $(div);

    // ------------------------------------------------------------------ Scroll Load Data ----------------------------------------------------------------------//

    let scrollLength = 2;
    $div.find('.messageArea').scroll(function () {
        if ($(this).scrollTop() == 0) {
            if ($('#' + ctrId).find('#scrollLength').val() != '') {
                let c = parseInt($('#' + ctrId).find('#scrollLength').val(), 10);
                scrollLength = c + 1;
            }
            $('#' + ctrId).find('#scrollLength').val(scrollLength);
            let count = $('#' + ctrId).find('#scrollLength').val();

            chatHub.server.getScrollingChatData(userEmail, email, loadMesgCount, count).done(function (msg) {
                for (i = 0; i < msg.length; i++) {
                    let firstMsg = $('#' + ctrId).find('#divMessage').find('.message:first');

                    // Where the page is currently:
                    let curOffset = firstMsg.offset().top - $('#' + ctrId).find('#divMessage').scrollTop();

                    // Prepend
                    $('#' + ctrId).find('#divMessage').prepend('<div class="message"><span class="userName">' + msg[i].userName + '</span>: ' + msg[i].message + '</div>');

                    // Offset to previous first message minus original offset/scroll
                    $('#' + ctrId).find('#divMessage').scrollTop(firstMsg.offset().top - curOffset);
                }
            });
        }
    });

    // DELETE BUTTON IMAGE
    $div.find('#imgDelete').click(function () {
        $('#' + ctrId).remove();
    });

    // Send Button event
    $div.find("#btnSendMessage").click(function () {
        $textBox = $div.find("#txtPrivateMessage");
        let msg = $textBox.val();
        if (msg.length > 0) {
            let currentDateTime = new Date().toLocaleTimeString();
            console.info(currentDateTime);
            chatHub.server.sendPrivateMessage(userId, msg, 'Click', currentDateTime);
            $textBox.val('');
        }
    });

    // Text Box event
    $div.find("#txtPrivateMessage").keyup(function (e) {
        if (e.which == 13) {
            $div.find("#btnSendMessage").click();
        }

        // Typing
        $textBox = $div.find("#txtPrivateMessage");
        let msg = $textBox.val();

        let currentDateTime = new Date().toLocaleTimeString();
        console.info(currentDateTime);
        if (msg.length > 0)
        {
            chatHub.server.sendPrivateMessage(userId, msg, 'Type', currentDateTime);
        }
        else
        {
            chatHub.server.sendPrivateMessage(userId, msg, 'Empty', currentDateTime);
        }

        clearInterval(refreshId);
        checkTyping(chatHub, userId, msg, $div, 5000);
    });

    AddDivToContainer($div);
}

function checkTyping(chatHub, userId, msg, $div, time) {
    refreshId = setInterval(function () {
        // Typing
        $textBox = $div.find("#txtPrivateMessage");
        let msg = $textBox.val();

        let currentDateTime = new Date().toLocaleTimeString();
        console.info(currentDateTime);

        if (msg.length == 0) {
            chatHub.server.sendPrivateMessage(userId, msg, 'Empty', currentDateTime);
        }
    }, time);
}

function AddDivToContainer($div) {
    $('#divContainer').prepend($div);
    $div.draggable({
        handle: ".header",
        stop: function () {
        }
    });
}
    // ------------------------------------------------------------------End Private Chat ----------------------------------------------------------------------//