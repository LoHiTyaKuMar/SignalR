using Microsoft.AspNet.SignalR;
using MVC_SignalR.Database;
using System;
using System.Collections.Generic;
using System.Linq;

namespace MVC_SignalR
{
    public class ChatHub : Hub
    {
        public static string emailIDLoaded = string.Empty;
        private int takeCounter = 0;
        private int skipCounter = 0;

        #region Connect
        public void Connect(string userName, string userEmail)
        {
            // 
            emailIDLoaded = userEmail;
            var id = Context.ConnectionId;
            using (SignalREntities dc = new SignalREntities())
            {
                var item = dc.tblChatUserDetails.FirstOrDefault(x => x.EmailID == userEmail);
                if (item != null)
                {
                    dc.tblChatUserDetails.Remove(item);
                    dc.SaveChanges();

                    // Disconnect
                    Clients.All.onUserDisconnectedExisting(item.ConnectionId, item.UserName);
                }

                var Users = dc.tblChatUserDetails.ToList();
                if (Users.Where(x => x.EmailID == userEmail).ToList().Count == 0)
                {
                    var userdetails = new tblChatUserDetail
                    {
                        ConnectionId = id,
                        UserName = userName,
                        EmailID = userEmail
                    };
                    dc.tblChatUserDetails.Add(userdetails);
                    dc.SaveChanges();

                    // send to caller
                    var connectedUsers = dc.tblChatUserDetails.ToList();
                    var CurrentMessage = dc.tblChatMessageDetails.ToList();
                    Clients.Caller.onConnected(id, userName, connectedUsers, CurrentMessage);
                }

                // send to all except caller client
                Clients.AllExcept(id).onNewUserConnected(id, userName, userEmail);
            }
        }
        #endregion

        #region Disconnect
        public override System.Threading.Tasks.Task OnDisconnected(bool stopCalled)
        {
            using (SignalREntities dc = new SignalREntities())
            {
                var item = dc.tblChatUserDetails.FirstOrDefault(x => x.ConnectionId == Context.ConnectionId);
                if (item != null)
                {
                    dc.tblChatUserDetails.Remove(item);
                    dc.SaveChanges();

                    var id = Context.ConnectionId;
                    Clients.All.onUserDisconnected(id, item.UserName);
                }
            }
            return base.OnDisconnected(stopCalled);
        }
        #endregion

        #region Send_To_All
        public void SendMessageToAll(string userName, string message)
        {
            // store last 100 messages in cache
            AddAllMessageinCache(userName, message);

            // Broad cast message
            Clients.All.messageReceived(userName, message);
        }
        #endregion

        #region Private_Messages
        public void SendPrivateMessage(string toUserId, string message, string status, DateTime dateTime)
        {
            string fromUserId = Context.ConnectionId;
            using (SignalREntities dc = new SignalREntities())
            {
                var chatUserDetails = dc.tblChatUserDetails;
                var toUser = chatUserDetails.FirstOrDefault(x => x.ConnectionId == toUserId);
                var fromUser = chatUserDetails.FirstOrDefault(x => x.ConnectionId == fromUserId);
                if (toUser != null && fromUser != null)
                {
                    if (status == "Click")
                    {
                        AddPrivateMessageinCache(fromUser.EmailID, toUser.EmailID, fromUser.UserName, message);
                    }

                    // send to 
                    Clients.Client(toUserId).sendPrivateMessage(fromUserId, fromUser.UserName, message, fromUser.EmailID, toUser.EmailID, status, fromUserId);

                    // send to caller user
                    Clients.Caller.sendPrivateMessage(toUserId, fromUser.UserName, message, fromUser.EmailID, toUser.EmailID, status, fromUserId);
                }
            }
        }

        public IEnumerable<PrivateChatMessage> GetPrivateMessage(string fromid, string toid, int take)
        {
            using (SignalREntities dc = new SignalREntities())
            {
                var msg = new List<PrivateChatMessage>();

                var v = (from a in dc.tblChatPrivateMessageMasters
                         join b in dc.tblChatPrivateMessageDetails on a.EmailID equals b.MasterEmailID into cc
                         from c in cc
                         where (c.MasterEmailID.Equals(fromid) && c.ChatToEmailID.Equals(toid)) || (c.MasterEmailID.Equals(toid) && c.ChatToEmailID.Equals(fromid))
                         orderby c.ID descending
                         select new
                         {
                             UserName = a.UserName,
                             Message = c.Message,
                             ID = c.ID
                         }).Take(take).ToList();
                v = v.OrderBy(s => s.ID).ToList();

                foreach (var a in v)
                {
                    var res = new PrivateChatMessage()
                    {
                        UserName = a.UserName,
                        Message = a.Message
                    };
                    msg.Add(res);
                }
                return msg;
            }
        }


        public IEnumerable<PrivateChatMessage> GetScrollingChatData(string fromid, string toid, int start = 10, int length = 1)
        {
            takeCounter = (length * start); // 20
            skipCounter = ((length - 1) * start); // 10

            using (SignalREntities dc = new SignalREntities())
            {
                var msg = new List<PrivateChatMessage>();
                var v = (from a in dc.tblChatPrivateMessageMasters
                         join b in dc.tblChatPrivateMessageDetails on a.EmailID equals b.MasterEmailID into cc
                         from c in cc
                         where (c.MasterEmailID.Equals(fromid) && c.ChatToEmailID.Equals(toid)) || (c.MasterEmailID.Equals(toid) && c.ChatToEmailID.Equals(fromid))
                         orderby c.ID descending
                         select new
                         {
                             UserName = a.UserName,
                             Message = c.Message,
                             ID = c.ID
                         }).Take(takeCounter).Skip(skipCounter).ToList();

                foreach (var a in v)
                {
                    var res = new PrivateChatMessage()
                    {
                        UserName = a.UserName,
                        Message = a.Message
                    };
                    msg.Add(res);
                }
                return msg;
            }
        }
        #endregion

        #region Save_Cache
        private void AddAllMessageinCache(string userName, string message)
        {
            using (SignalREntities dc = new SignalREntities())
            {
                var messageDetail = new tblChatMessageDetail
                {
                    UserName = userName,
                    Message = message,
                    EmailID = emailIDLoaded
                };
                dc.tblChatMessageDetails.Add(messageDetail);
                dc.SaveChanges();
            }
        }

        private void AddPrivateMessageinCache(string fromEmail, string chatToEmail, string userName, string message)
        {
            using (SignalREntities dc = new SignalREntities())
            {
                // Save master
                var master = dc.tblChatPrivateMessageMasters.ToList().Where(a => a.EmailID.Equals(fromEmail)).ToList();
                if (master.Count == 0)
                {
                    var result = new tblChatPrivateMessageMaster
                    {
                        EmailID = fromEmail,
                        UserName = userName
                    };
                    dc.tblChatPrivateMessageMasters.Add(result);
                    dc.SaveChanges();
                }

                // Save details
                var resultDetails = new tblChatPrivateMessageDetail
                {
                    MasterEmailID = fromEmail,
                    ChatToEmailID = chatToEmail,
                    Message = message
                };
                dc.tblChatPrivateMessageDetails.Add(resultDetails);
                dc.SaveChanges();
            }
        }
        #endregion
    }

    public class PrivateChatMessage
    {
        public string UserName { get; set; }
        public string Message { get; set; }
    }
}