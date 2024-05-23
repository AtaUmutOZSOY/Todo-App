using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Todo_App.Domain.Entities;
public class Tag
{
    public int Id { get; set; }
    public string Value { get; set; }

    public int TodoItemId { get; set; }
    public TodoItem TodoItem { get; set; }
}

