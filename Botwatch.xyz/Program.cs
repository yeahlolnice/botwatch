using Botwatch.Data;
using Botwatch.xyz.Components;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

// -------------------- Services --------------------

builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

builder.Services.AddDbContext<BotContext>(options =>
    options.UseNpgsql(config.GetConnectionString("DatabaseConnection")));

builder.Services.AddHttpContextAccessor();
builder.Services.AddAntiforgery();

// JWT Auth
var jwtKey = config["Jwt:Key"];
var jwtIssuer = config["Jwt:Issuer"];

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtIssuer,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey!))
    };
});

builder.Services.AddAuthorization();

builder.Services.AddRazorPages(); // required for RazorComponents
builder.Services.AddServerSideBlazor(); // needed for `.razor` endpoints

var app = builder.Build();

// -------------------- Middleware --------------------

if (!app.Environment.IsDevelopment())
    app.UseExceptionHandler("/Error", createScopeForErrors: true);

app.UseStaticFiles();
app.UseAntiforgery(); // Enforced globally except where [IgnoreAntiforgeryToken] is applied

app.UseAuthentication();
app.UseAuthorization();

// -------------------- Routes --------------------
// (Other tracking endpoints like /t/form, /t/c go here)
app.MapPost("/t/form/{formName}", [IgnoreAntiforgeryToken] async (
    string formName,
    HttpContext http,
    [FromForm] Dictionary<string, string> form,
    BotContext db) =>
{
    var vid = http.Request.Cookies.TryGetValue("bw_vid", out var cookie) && !string.IsNullOrWhiteSpace(cookie)
        ? cookie
        : Guid.NewGuid().ToString("N");

    bool isBot = form.TryGetValue("website", out var trap) && !string.IsNullOrWhiteSpace(trap);
    long? tts = null;
    if (form.TryGetValue("_render_ts", out var ts) && long.TryParse(ts, out var clientTs))
        tts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - clientTs;

    var evt = new TrackingEvent
    {
        VisitorId = vid,
        EventKey = formName,
        Path = http.Request.Path,
        UserAgent = http.Request.Headers.UserAgent.ToString(),
        Referer = http.Request.Headers.Referer.ToString(),
        Ip = http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        FormDataJson = System.Text.Json.JsonSerializer.Serialize(form),
        HoneypotTriggered = isBot,
        TimeToSubmitMs = tts,
    };

    db.TrackingEvents.Add(evt);
    await db.SaveChangesAsync();

    return Results.Content("<h3>Thanks for submitting</h3>", "text/html");
});


app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();
