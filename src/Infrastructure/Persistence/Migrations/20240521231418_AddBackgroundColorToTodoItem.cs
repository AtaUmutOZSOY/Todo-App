using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Todo_App.Infrastructure.Persistence.Migrations
{
    public partial class AddBackgroundColorToTodoItem : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BackgroundColor",
                table: "TodoItems",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BackgroundColor",
                table: "TodoItems");
        }
    }
}
