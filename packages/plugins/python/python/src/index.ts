import {GraphQLSchema} from "graphql"
import {Types} from '@graphql-codegen/plugin-helpers'
import {PythonVisitor} from "./visitor"

const {printSchema, parse, visit} = require('graphql')


export const plugin = (schema: GraphQLSchema, documents: Types.DocumentFile[], config: {}) => {
    const visitor = new PythonVisitor(schema, {})
    const printedSchema = printSchema(schema) // Returns a string representation of the schema
    const astNode = parse(printedSchema) // Transforms the string into ASTNode

    const result = visit(astNode, {leave: visitor})

    return (result.definitions.join('\n')).replace(/\n+$/g, "\n")
}