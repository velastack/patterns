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

### Field types

Vela supports the following field types:

```
text
number
bool
date
email
password
url
editor
autodate
select
file/files
json
geoPoint
relation
```

### autodate

The `autodate` field type is a special field type that automatically sets the field to the current date and time on creation or update. The field names for autodate can be: `created/created_at` or `updated/updated_at`.

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

Fields are marked as required by appending `!` to the field name. This marks the field as required in the database and the Zod schema for form validation.

```
model pets name:string! age:number!
```

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

If the model is nested within another model, vela traverses the model heirchay to find the nearest parent model with a relationship to the authenticated user.

```
model teams name:string
model users email:string team:references
model projects title:text team:references
```

In this example, the `users` model is associated with the `teams` model. Access to the `projects` model is restricted to users who are members of the project's team.
