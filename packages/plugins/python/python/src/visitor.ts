import {BaseTypesVisitor} from '@graphql-codegen/visitor-plugin-common'
import {
    DirectiveDefinitionNode,
    EnumTypeDefinitionNode,
    FieldDefinitionNode,
    GraphQLSchema,
    InputObjectTypeDefinitionNode,
    InputValueDefinitionNode,
    InterfaceTypeDefinitionNode,
    ListTypeNode,
    NamedTypeNode,
    NonNullTypeNode,
    ObjectTypeDefinitionNode,
    ScalarTypeDefinitionNode,
    UnionTypeDefinitionNode,
    ValueNode
} from 'graphql'
import snakeCase from "snake-case-typescript"

function indent(fieldDefinition: string, count: number = 1) {
    return "    ".repeat(count) + fieldDefinition
}

function valueToPythonValue(value: ValueNode): string {
    if (!value.kind) {
        return `"${value}"`
    } else {
        switch (value.kind) {
            case "BooleanValue":
                return value.value ? "True" : "False"
            case "FloatValue":
                return value.value.toString()
            case "IntValue":
                return value.value.toString()
            case "NullValue":
                return "None"
            case "StringValue":
                return `"${value.value}"`
            case "ListValue":
                return `[${value.values.map((value) => valueToPythonValue(value)).join(", ")}]`
            case "ObjectValue":
                return `{${value.fields.map((value) => `"${value.name}": ${valueToPythonValue(value.value)}`).join(", ")}}`
            case "EnumValue":
                return `"${value.value}"`
            default:
                throw Error(`Type ${value.kind} is not yet implemented.`)

        }
    }
}

function appendKwargs(current: string, newKwargs: { [k: string]: string }) {

    let kwargStrings = []
    for (let key in newKwargs) {
        newKwargs[key] && kwargStrings.push(`${key}=${newKwargs[key]}`)
    }
    if (kwargStrings.length > 0) {
        let kwargString = kwargStrings.join(", ")
        let newString = current.replace(/\(\)$/g, `(${kwargString})`)
        if (newString === current) {
            newString = current.replace(/\)$/g, `, ${kwargString})`)
        }
        return newString
    } else {
        return current
    }
}

export class PythonVisitor extends BaseTypesVisitor<any, any> {
    constructor(schema: GraphQLSchema, pluginConfig: any, additionalConfig?: any) {
        super(schema, {...pluginConfig}, {})
    }

    InterfaceTypeDefinition(node: InterfaceTypeDefinitionNode, key: number | string | undefined, parent: any): string {
        let classDescription = (node.description as any) as string
        if (classDescription) {
            classDescription = "\n" + indent(`"""${classDescription}"""`)
        } else {
            classDescription = ""
        }
        return `class ${node.name}(Interface):` + classDescription + "\n" + node.fields!.map((field) => indent((field as any) as string)).join("\n") + "\n\n"
    }


    ObjectTypeDefinition(node: ObjectTypeDefinitionNode, key: number | string | undefined, parent: any): string {
        let classDescription = (node.description as any) as string
        if (classDescription) {
            classDescription = "\n" + indent(`"""${classDescription}"""`)
        } else {
            classDescription = ""
        }

        let classHeader = `class ${node.name}(ObjectType):` + classDescription + "\n"

        /*
        Does not work with graphene in it's current state
        let classMetaLines = ['class Meta:']
        if (node.interfaces && node.interfaces.length > 0) {
            classMetaLines.push(indent(`interfaces = [${node.interfaces.map((interface_) => `${interface_}`)}]`))
        }
        let classMeta = classMetaLines.length > 1 ? classMetaLines.map(line => indent(line)).join("\n") + "\n\n" : ""
        */

        if (node.interfaces && node.interfaces.length > 0) {
            console.log("Warning: Interface inheritance is not yet supported!")
        }
        let classBody = node.fields!.map(field => indent((field as any) as string)).join("\n")

        return classHeader + classBody + "\n\n"
    }

    InputObjectTypeDefinition(node: InputObjectTypeDefinitionNode): string {
        let classDescription = (node.description as any) as string
        if (classDescription) {
            classDescription = "\n" + indent(`"""${classDescription}"""`)
        } else {
            classDescription = ""
        }

        let classHeader = `class ${node.name}(InputObjectType):` + classDescription + "\n"
        let classBody = node.fields!.map(field => indent((field as any) as string)).join("\n")

        return classHeader + classBody + "\n\n"
    }

    UnionTypeDefinition(node: UnionTypeDefinitionNode, key: string | number | undefined, parent: any): string {
        let unionHeader = `class ${node.name}(Union):\n`
        if (node.description) {
            unionHeader += indent(`"""${(node.description as any) as string}"""\n`)
        }

        let unionMetaLines = ['class Meta:']
        if (node.types && node.types.length > 0) {
            unionMetaLines.push(indent(`types = (${node.types.map((type) => `lambda: ${type}`).join(", ")})`))
        }

        let unionMeta = unionMetaLines.length > 1 ? unionMetaLines.map((line) => indent(line)).join("\n") : ""
        return unionHeader + unionMeta + "\n\n"
    }

    NamedType(node: NamedTypeNode): string {
        return super.NamedType(node)
    }

    NonNullType(node: NonNullTypeNode): string {
        return `NonNull(${node.type})`
    }

    ListType(node: ListTypeNode): string {
        return `List(${node.type})`
    }

    FieldDefinition(node: FieldDefinitionNode, key?: number | string, parent?: any): string {
        const nodeName = snakeCase((node.name as any) as string)
        let field = `Field(lambda: ${node.type})`

        const nodeDescription = (node.description as any) as string
        if (nodeDescription) {
            field = appendKwargs(field, {description: `"${nodeDescription}"`})
        }

        if (node.arguments && node.arguments.length > 0) {
            let parsedArguments = node.arguments.map((argument: InputValueDefinitionNode, index: number, schema: ReadonlyArray<InputValueDefinitionNode>) => {
                let argumentString = (argument as any) as string
                argumentString = argumentString.replace("Field", "Argument")
                argumentString = argumentString.replace(" = ", "=")
                return argumentString
            })
            field = field.replace(/\)$/g, ", " + parsedArguments.join(", ") + ")")
        }

        if (node.directives) {
            node.directives.filter((directive) => ((directive.name as any) as string) === "deprecated").forEach(directive => {
                    let reason = directive.arguments && directive.arguments.filter((argument) => (((argument.name as any) as string) === "reason"))
                    if (reason && reason[0]) {
                        field = appendKwargs(field, {deprecation_reason: `"${reason[0].value}"`})
                    } else {
                        field = appendKwargs(field, {deprecation_reason: `"No reason specified."`})
                    }
                }
            )
        }

        return `${nodeName} = ${field}`
    }

    ScalarTypeDefinition(node: ScalarTypeDefinitionNode): string {
        return `class ${node.name}(Scalar):\n` + indent(`serialize = lambda x: str(x)`) + "\n\n"
    }


    InputValueDefinition(node: InputValueDefinitionNode, key?: number | string, parent?: any): string {
        const nodeName = snakeCase((node.name as any) as string)
        let field = `Field(lambda: ${node.type})`


        const nodeDescription = (node.description as any) as string
        if (nodeDescription) {
            field = appendKwargs(field, {description: `"${nodeDescription}"`})
        }

        if (node.defaultValue) {
            field = appendKwargs(field, {default_value: `${valueToPythonValue(node.defaultValue)}`})
        }

        return `${nodeName} = ${field}`
    }

    EnumTypeDefinition(node: EnumTypeDefinitionNode): string {
        let parsedValues: string[] = []
        if (node.values) {
            parsedValues = node.values.map((value => `"${(value.name as any) as string}"`))
        }

        let Enum = `Enum("${node.name}", [${parsedValues.join(", ")}])`

        if (node.description) {
            Enum = appendKwargs(Enum, {description: `"${(node.description as any) as string}"`})
        }

        return `${node.name} = ${Enum}\n\n`
    }

    DirectiveDefinition(node: DirectiveDefinitionNode): string {
        console.log("Warning: Directives are not implemented yet!")
        /*
        GraphQLDirective uses other types than graphene.
        return `${node.name} = GraphQLDirective(
            name="${node.name}",
            description="${node.description || ""}",
            args={
                ${node.arguments!.map((argument) => `"${argument}"`).join(",\n")}
            }
        )
        `
        return "DirectiveDefinition"
        */
        return ""
    }

    protected _getTypeForNode(node: NamedTypeNode): string {
        return `${node.name}`
    }


}