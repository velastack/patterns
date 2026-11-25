# Parsing

The VelaStack CLI has a powerful syntax for collection and field generation.

From the docs:

Vela provides a generator for creating database models, forms, resources, schemas and full CRUD scaffolds. Each of these shares a common syntax. Within the syntax, singular and plural forms have significance.

### Syntax

```
$ vela generate <type> <name> [fields...]
```

### Name

The plural name of the model, form, resource, schema or scaffold, for example `pets` or `todos`. Model names are always plural and will be converted to plural if the singular form is provided. Names can be nested within directories by using a slash (`/`) separator. For example, `users/pets` will create a resource at `/users/pets`.

### Fields

The fields are defined as `name:type` pairs, for example `name:string` or `age:number`. If the model already exists in the database, the `fields` option can be omitted and the generator will use the existing fields.

A field name starts with a letter and holds letters, digits and underscores: `title`, `firstName`, `first_name`.

The whole syntax is also exported as plain text, `FIELD_SYNTAX_HELP`, built from the table the parser reads (`syntax.ts`). The CLI prints it under `--help`.

### Field types

Vela supports the following field types:

```
text      (also: string)
number    (also: integer, int, float, decimal, double)
bool      (also: boolean)
date      (also: datetime, timestamp)
email
url
password
editor
json
geoPoint  (also: geopoint)
select
file      (also: files)
relation  (also: references)
autodate
```

### autodate

The `autodate` field type is set by PocketBase, never by a form. The field name says when: a name holding `create` (`created`, `created_at`, `createdAt`) is set when the record is created, a name holding `update` (`updated`, `updated_at`, `updatedAt`) is set then and again on every update. Any other name is an error.

Every collection a generator creates gets a `created` and an `updated` autodate field without being asked, as collections made in PocketBase's own dashboard do, so `sort: "-created"` works. They are part of the collection only: they are left out of the Zod schema, the forms, the pages and the fixtures. Declare a field named `created` or `updated` yourself and yours is used instead.

### select

The select field has special syntax for defining the options. The options are defined as `value:label` pairs. The singular or plural form of the field name determines whether the select acts as a single or multi-select.

```
model pets type:select(dog:Dog,cat:Cat,bird:Bird)
```

```
model products colors:select(red:Red,green:Green,blue:Blue)
```

### file

The file field is used to upload files to the server. The single or plural form of the field name determines whether the field accepts a single file or an array of files.

```
model owners avatar:file
```

```
model pets photos:files
```

### Required fields

Fields are marked as required by appending `!` to the type. This marks the field as required in the database and the Zod schema for form validation.

```
model pets name:string! age:number! type:select(dog,cat)!
```

### Unique fields

A third segment, `:unique`, gives the collection a unique index on the field, so no two records can hold the same value. It comes after the type and its `!`:

```
model coupons code:text!:unique
model posts title:text! slug:text:unique
```

The index is ``CREATE UNIQUE INDEX `idx_<collection>_<field>` ON `<collection>` (`<field>`)``. An empty value counts as a value, so a unique field that is not required can be left blank by one record only: combine it with `!` unless that is what you want.

`vela generate migration <collection> add code:text!:unique` adds the index along with the field.

A field that holds no single value cannot be unique: `json`, `geoPoint`, `file`, `password`, `autodate`, `bool`, and a select or relation that takes several. `unique` is the only modifier; anything else in the third segment is an error.

### Relationships

In addition to the field types above, Vela supports passing in the name of any existing model to create a relationship. Single vs plural has significance here, as it determines whether the relationship is a one-to-many or many-to-many.

```
model pets name:string owner:user
```

```
model teams name:string members:users
```

Similarly to Ruby on Rails, the shorthand `references` can be used to create relationships based on the field name.

```
model posts title:string author:user tags:references
```

### Ownership and permissions

<div class="flex gap-1 mb-2">
	<Badge variant="outline" href="/enable/auth" class="no-underline">Depends: auth</Badge>
</div>

If authentication is enabled with the `vela enable auth` command, it's possible to associate models with the authenticated user. This can be done directly on the model with the special `current_user` field type, which will automatically set the field to the authenticated user on creation (and exclude the field from the frontend form).

```
model posts title:string author:current_user
```

If the model is nested within another model, vela traverses the model hierarchy to find the nearest parent model with a relationship to the authenticated user.

```
model teams name:string
model users email:string team:references
model projects title:text team:references
```

In this example, the `users` model is associated with the `teams` model. Access to the `projects` model is restricted to users who are members of the project's team.

If teams are enabled with the `vela enable teams` command, a model field can be associated with the user's currently-active team via the special `current_team` field type, which automatically sets the field to `locals.team` on creation and excludes it from the frontend form.

```
model posts title:string team:current_team
```

### Rules

A new collection's five API rules (list, view, create, update, delete) follow from the above:

- with auth enabled and a relation path to `users`, the owner rule, for example `@request.auth.id = user.id`;
- with auth enabled and no such path, `@request.auth.id != ""`: every signed-in user can read and write;
- without auth, no rules: only the server's superuser client (`locals.admin`) can read or write.

The `rules` input (`options.input.rules`, the CLI's `--rules`) picks one outright, for every generator that creates a collection (`resource`, `scaffold`, `scaffold --remote`):

| Value       | Rules                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| `auth`      | `@request.auth.id != ""` on all five, even when an owner path exists.                                  |
| `owner`     | The inferred owner rule. An error when no relation path leads to `users`.                              |
| `superuser` | All five `null`: only the superuser client can read or write. The scaffolds' pages use `locals.admin`. |

`auth` and `owner` need the auth feature. Any other value is an error, and so is passing `rules` when the collection already exists: rules are set as the collection is created.

With `superuser`, the result carries `notes` saying that pages have to go through `locals.admin`, and that the scaffold's pages therefore let everyone who can open them read and write every record.
