using Microsoft.Owin;
using Owin;

[assembly: OwinStartup(typeof(MVC_SignalR.Startup))]
namespace MVC_SignalR
{
    public partial class Startup
    {
        public void Configuration(IAppBuilder app)
        {
            //ConfigureAuth(app);

            // Any connection or hub wire up and configuration should go here
            app.MapSignalR();
        }
    }
}
