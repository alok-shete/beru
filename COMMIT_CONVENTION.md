# Commit Message Convention Guide

This document outlines the structure and guidelines for creating commit messages in our project. Following these conventions helps maintain a clear and useful git history.

## Commit Message Structure

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Elements

1. **Type**: Describes the kind of change (required)
2. **Scope**: Indicates the scope of the change (optional)
3. **Description**: A brief summary of the change (required)
4. **Body**: Provides additional contextual information (optional)
5. **Footer**: Contains any breaking changes or issue references (optional)

## Types

Choose one of the following types for your commit:

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Changes to documentation
- `style`: Formatting, missing semi-colons, etc; no code change
- `refactor`: Refactoring production code
- `test`: Adding missing tests, refactoring tests; no production code change
- `chore`: Updating grunt tasks etc; no production code change

## Scope

The scope is optional and can be anything specifying the place of the commit change. For example:
- Component name
- File name
- Module name

## Description

The description is a short summary of the code changes, typically limited to 50 characters or less. It should be written in the imperative mood, as if giving a command or instruction.

## Body

The body is optional and used to provide additional context about the code changes. It should be wrapped at 72 characters and written in the imperative mood.

## Footer

The footer is optional and is used to reference issue tracker IDs or indicate breaking changes.

## Example

```
feat(core): implement useState hook

- Add useState hook for managing local component state
- Include basic tests for useState functionality

Closes #123
```

## Best Practices

1. Use the imperative mood in the subject line
2. Do not end the subject line with a period
3. Capitalize the subject line
4. Separate subject from body with a blank line
5. Use the body to explain what and why vs. how
6. Can use multiple lines with "-" or "*" for bullet points in body

Remember, these conventions are guidelines to help improve the project's git history. The most important thing is to be clear and provide useful information for your fellow developers.