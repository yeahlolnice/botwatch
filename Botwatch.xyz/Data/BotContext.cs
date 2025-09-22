using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;

namespace Botwatch.Data
{
    public class BotContext : DbContext
    {
        public BotContext(DbContextOptions<BotContext> options) : base(options) { }

        public DbSet<BotRequest> BotRequests { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<AdminLoginAttempt> AdminLoginAttempts { get; set; }
        public DbSet<TrackingEvent> TrackingEvents { get; set; }
    }

    public class BotRequest
    {
        public int Id { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string IP { get; set; }
        public string UserAgent { get; set; }
        public string Path { get; set; }
        public string Method { get; set; }
    } 

    public class User
    {
        public int Id { get; set; }
        public string Username { get; set; }
        public string PasswordHash { get; set; }  // Store hashed passwords!
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class AdminLoginAttempt
    {
        public int Id { get; set; }
        public string UsernameAttempted { get; set; }
        public string PasswordAttempted { get; set; } // Only for analysis; don’t use for real auth
        public string IP { get; set; }
        public string UserAgent { get; set; }
        public string RawRequestPath { get; set; }
        public string HeadersJson { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public bool IsSuccess { get; set; }
    }
}
