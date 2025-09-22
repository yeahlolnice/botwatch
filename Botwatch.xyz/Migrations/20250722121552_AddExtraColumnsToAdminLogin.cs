using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Botwatch.xyz.Migrations
{
    /// <inheritdoc />
    public partial class AddExtraColumnsToAdminLogin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Success",
                table: "AdminLoginAttempts",
                newName: "IsSuccess");

            migrationBuilder.AddColumn<string>(
                name: "HeadersJson",
                table: "AdminLoginAttempts",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PasswordAttempted",
                table: "AdminLoginAttempts",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "RawRequestPath",
                table: "AdminLoginAttempts",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HeadersJson",
                table: "AdminLoginAttempts");

            migrationBuilder.DropColumn(
                name: "PasswordAttempted",
                table: "AdminLoginAttempts");

            migrationBuilder.DropColumn(
                name: "RawRequestPath",
                table: "AdminLoginAttempts");

            migrationBuilder.RenameColumn(
                name: "IsSuccess",
                table: "AdminLoginAttempts",
                newName: "Success");
        }
    }
}
