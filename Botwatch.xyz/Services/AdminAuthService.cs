namespace Botwatch.Services
{
    public class AdminAuthService
    {
        public bool IsAdminAuthenticated { get; private set; }

        public void SignIn()
        {
            IsAdminAuthenticated = true;
        }

        public void SignOut()
        {
            IsAdminAuthenticated = false;
        }
    }
}
