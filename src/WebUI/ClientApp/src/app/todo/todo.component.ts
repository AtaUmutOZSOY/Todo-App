import { Component, TemplateRef, OnInit } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import {
  TodoListsClient, TodoItemsClient,
  TodoListDto, TodoItemDto, PriorityLevelDto,
  CreateTodoListCommand, UpdateTodoListCommand,
  CreateTodoItemCommand, UpdateTodoItemDetailCommand
} from '../web-api-client';

@Component({
  selector: 'app-todo-component',
  templateUrl: './todo.component.html',
  styleUrls: ['./todo.component.scss']
})
export class TodoComponent implements OnInit {
  debug = false;
  deleting = false;
  deleteCountDown = 0;
  deleteCountDownInterval: any;
  lists: TodoListDto[];
  priorityLevels: PriorityLevelDto[];
  selectedList: TodoListDto;
  selectedItem: TodoItemDto;
  newListEditor: any = {};
  listOptionsEditor: any = {};
  newListModalRef: BsModalRef;
  listOptionsModalRef: BsModalRef;
  deleteListModalRef: BsModalRef;
  itemDetailsModalRef: BsModalRef;
  colorOptions: { name: string, value: string }[] = [
    { name: 'New', value: '#FFB3B3' },
    { name: 'In Process', value: '#B3FFB3' },
    { name: 'Completed', value: '#B3B3FF' },
    { name: 'Cancelled', value: '#FFFFB3' },
    { name: 'Not Completed', value: '#FFB3FF' }
  ];

  itemDetailsFormGroup = this.fb.group({
    id: [null],
    listId: [null],
    priority: [''],
    note: [''],
    backgroundColor: ['#FFFFFF'],  // Default backgroundColor to white
    tags: ['']
  });

  constructor(
    private listsClient: TodoListsClient,
    private itemsClient: TodoItemsClient,
    private modalService: BsModalService,
    private fb: FormBuilder
  ) { }

  ngOnInit(): void {
    this.listsClient.get().subscribe(
      result => {
        this.lists = result.lists;
        this.priorityLevels = result.priorityLevels;
        if (this.lists.length) {
          this.selectedList = this.lists[0];
        }
      },
      error => console.error(error)
    );
  }

  // Lists
  remainingItems(list: TodoListDto): number {
    return list.items.filter(t => !t.done).length;
  }

  showNewListModal(template: TemplateRef<any>): void {
    this.newListModalRef = this.modalService.show(template);
    setTimeout(() => document.getElementById('title').focus(), 250);
  }

  newListCancelled(): void {
    this.newListModalRef.hide();
    this.newListEditor = {};
  }

  addList(): void {
    const list = {
      id: 0,
      title: this.newListEditor.title,
      items: []
    } as TodoListDto;

    this.listsClient.create(list as CreateTodoListCommand).subscribe(
      result => {
        list.id = result;
        this.lists.push(list);
        this.selectedList = list;
        this.newListModalRef.hide();
        this.newListEditor = {};
      },
      error => {
        const errors = JSON.parse(error.response);

        if (errors && errors.Title) {
          this.newListEditor.error = errors.Title[0];
        }

        setTimeout(() => document.getElementById('title').focus(), 250);
      }
    );
  }

  showListOptionsModal(template: TemplateRef<any>) {
    this.listOptionsEditor = {
      id: this.selectedList.id,
      title: this.selectedList.title
    };

    this.listOptionsModalRef = this.modalService.show(template);
  }

  updateListOptions() {
    const list = this.listOptionsEditor as UpdateTodoListCommand;
    this.listsClient.update(this.selectedList.id, list).subscribe(
      () => {
        (this.selectedList.title = this.listOptionsEditor.title),
          this.listOptionsModalRef.hide();
        this.listOptionsEditor = {};
      },
      error => console.error(error)
    );
  }

  confirmDeleteList(template: TemplateRef<any>) {
    this.listOptionsModalRef.hide();
    this.deleteListModalRef = this.modalService.show(template);
  }

  deleteListConfirmed(): void {
    this.listsClient.delete(this.selectedList.id).subscribe(
      () => {
        this.deleteListModalRef.hide();
        this.lists = this.lists.filter(t => t.id !== this.selectedList.id);
        this.selectedList = this.lists.length ? this.lists[0] : null;
      },
      error => console.error(error)
    );
  }

  // Items
  showItemDetailsModal(template: TemplateRef<any>, item: TodoItemDto): void {
    this.selectedItem = item;
    this.itemDetailsFormGroup.patchValue(this.selectedItem);

    this.itemDetailsModalRef = this.modalService.show(template);
    this.itemDetailsModalRef.onHidden.subscribe(() => {
      this.resetForm();
      this.stopDeleteCountDown();
    });
  }

  updateItemDetails(): void {
    const item = {
      id: this.itemDetailsFormGroup.value.id,
      listId: this.itemDetailsFormGroup.value.listId,
      priority: this.itemDetailsFormGroup.value.priority,
      note: this.itemDetailsFormGroup.value.note,
      backgroundColor: this.itemDetailsFormGroup.value.backgroundColor, // Ensure this property is included
      tags: this.itemDetailsFormGroup.value.tags // Ensure tags are included
    } as UpdateTodoItemDetailCommand;

    this.itemsClient.updateItemDetails(item.id, item).subscribe(
      () => {
        if (this.selectedItem.listId !== item.listId) {
          this.selectedList.items = this.selectedList.items.filter(
            i => i.id !== this.selectedItem.id
          );
          const listIndex = this.lists.findIndex(
            l => l.id === item.listId
          );
          this.selectedItem.listId = item.listId;
          this.lists[listIndex].items.push(this.selectedItem);
        }

        this.selectedItem.priority = item.priority;
        this.selectedItem.note = item.note;
        this.selectedItem.backgroundColor = item.backgroundColor; // Ensure this property is updated
        this.selectedItem.tags = item.tags; // Ensure tags are updated
        this.itemDetailsModalRef.hide();
        this.itemDetailsFormGroup.reset();
      },
      error => console.error(error)
    );
  }

  addItem() {
    const item = {
      id: 0,
      listId: this.selectedList.id,
      priority: this.priorityLevels[0].value,
      title: '',
      done: false,
      backgroundColor: '#FFFFFF',  // Default background color
      tags: []
    } as TodoItemDto;

    this.selectedList.items.push(item);
    const index = this.selectedList.items.length - 1;
    this.editItem(item, 'itemTitle' + index);
  }

  editItem(item: TodoItemDto, inputId: string): void {
    this.selectedItem = item;
    setTimeout(() => document.getElementById(inputId).focus(), 100);
  }

  updateItem(item: TodoItemDto, pressedEnter: boolean = false): void {
    const isNewItem = item.id === 0;

    if (!item.title.trim()) {
      this.deleteItem(item);
      return;
    }

    if (item.id === 0) {
      this.itemsClient
        .create({
          ...item, listId: this.selectedList.id
        } as CreateTodoItemCommand)
        .subscribe(
          result => {
            item.id = result;
          },
          error => console.error(error)
        );
    } else {
      this.itemsClient.update(item.id, item).subscribe(
        () => console.log('Update succeeded.'),
        error => console.error(error)
      );
    }

    this.selectedItem = null;

    if (isNewItem && pressedEnter) {
      setTimeout(() => this.addItem(), 250);
    }
  }

  deleteItem(item: TodoItemDto, countDown?: boolean) {
    if (countDown) {
      if (this.deleting) {
        this.stopDeleteCountDown();
        return;
      }
      this.deleteCountDown = 3;
      this.deleting = true;
      this.deleteCountDownInterval = setInterval(() => {
        if (this.deleting && --this.deleteCountDown <= 0) {
          this.deleteItem(item, false);
        }
      }, 1000);
      return;
    }
    this.deleting = false;
    if (this.itemDetailsModalRef) {
      this.itemDetailsModalRef.hide();
    }

    if (item.id === 0) {
      const itemIndex = this.selectedList.items.indexOf(this.selectedItem);
      this.selectedList.items.splice(itemIndex, 1);
    } else {
      this.itemsClient.delete(item.id).subscribe(
        () =>
          (this.selectedList.items = this.selectedList.items.filter(
            t => t.id !== item.id
          )),
        error => console.error(error)
      );
    }
  }

  cancelUpdate() {
    this.itemDetailsModalRef.hide();
  }

  resetForm() {
    this.itemDetailsFormGroup.reset({
      id: null,
      listId: null,
      priority: '',
      note: '',
      backgroundColor: '#FFFFFF',  // Reset to default color
      tags: []
    });
  }

  stopDeleteCountDown() {
    clearInterval(this.deleteCountDownInterval);
    this.deleteCountDown = 0;
    this.deleting = false;
  }

  addTag(item: TodoItemDto, tag: string): void {
    if (tag && !item.tags.includes(tag)) {
      item.tags.push(tag);
      this.updateItem(item);
    }
  }

  removeTag(item: TodoItemDto, tag: string): void {
    item.tags = item.tags.filter(t => t !== tag);
    this.updateItem(item);
  }

  updateTags(event: Event): void {
    const input = event.target as HTMLInputElement;
    const tags = input.value.split(',').map(tag => tag.trim());
    this.itemDetailsFormGroup.patchValue({ tags: tags });
  }

  filterTodosByTag(tag: string): void {
    if (tag) {
      this.selectedList.items = this.selectedList.items.filter(item => item.tags.includes(tag));
    } else {
      this.listsClient.get().subscribe(
        result => {
          this.lists = result.lists;
          this.priorityLevels = result.priorityLevels;
          if (this.lists.length) {
            this.selectedList = this.lists[0];
          }
        },
        error => console.error(error)
      );
    }
  }

  searchTodos(text: string): void {
    if (text) {
      this.selectedList.items = this.selectedList.items.filter(item => item.title.includes(text) || item.note.includes(text));
    } else {
      this.listsClient.get().subscribe(
        result => {
          this.lists = result.lists;
          this.priorityLevels = result.priorityLevels;
          if (this.lists.length) {
            this.selectedList = this.lists[0];
          }
        },
        error => console.error(error)
      );
    }
  }
}
