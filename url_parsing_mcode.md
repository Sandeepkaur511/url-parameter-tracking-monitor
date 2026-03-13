# URL Parameter Parsing in Power BI (M Code)

This Power Query (M) script demonstrates how raw URLs can be parsed into
structured parameter keys for analytics monitoring.

The transformation pipeline extracts query parameters from URLs,
splits them into key-value pairs, validates parameter names, and
classifies them into **parameter keys** and **tag keys**.

---

## Input Data

The dataset contains raw page URLs from web logs.

Example:

| date | page_location |
|-----|-----|
| 2026-03-10 | /search?q=laptop&source=google&tags=cat:electronics|brand:hp |

---

## Parsing Workflow

1. Extract query string from the URL
2. Split query string into key-value pairs
3. Separate **standard parameters** and **tag parameters**
4. Validate parameter names
5. Expand parameters into rows for analysis

---

## Power Query (M) Implementation

```m
let

    // Example source table
    Source = WebLogTable,

    // Step 1: Extract query string
    AddQueryString =
        Table.AddColumn(
            Source,
            "QueryString",
            each try Text.AfterDelimiter([page_location], "?") otherwise null
        ),

    // Step 2: Split parameters by "&"
    SplitQueryParams =
        Table.AddColumn(
            AddQueryString,
            "KeyValuePairs",
            each try Text.Split([QueryString], "&") otherwise {}
        ),

    // Step 3: Keep valid key=value pairs
    FilterValidPairs =
        Table.AddColumn(
            SplitQueryParams,
            "ValidPairs",
            each List.Select([KeyValuePairs], each Text.Contains(_, "="))
        ),

    // Step 4: Separate normal params and tag parameters
    SplitParamAndTagKeys =
        Table.AddColumn(
            FilterValidPairs,
            "ParamAndTagKeys",
            each
                let
                    tagsIndex =
                        List.PositionOf(
                            [ValidPairs],
                            List.First(
                                List.Select([ValidPairs], each Text.StartsWith(_, "tags=")),
                                null
                            )
                        ),

                    paramPairs =
                        if tagsIndex <> -1
                        then List.FirstN([ValidPairs], tagsIndex)
                        else [ValidPairs],

                    tagPair =
                        if tagsIndex <> -1
                        then [ValidPairs]{tagsIndex}?
                        else null,

                    tagValue =
                        if tagPair <> null
                        then Text.AfterDelimiter(tagPair, "tags=")
                        else null,

                    tagParts =
                        if tagValue <> null
                        then Text.Split(tagValue, "|")
                        else {},

                    paramKeys =
                        List.Transform(
                            paramPairs,
                            each Text.Lower(Text.BeforeDelimiter(_, "="))
                        ),

                    tagKeys =
                        List.Transform(
                            tagParts,
                            each Text.Lower(Text.BeforeDelimiter(_, ":"))
                        )

                in
                    [ParamKeys = paramKeys, TagKeys = tagKeys]
        ),

    // Step 5: Key validation function
    IsValidKey = (key as text) as logical =>
        let
            isAlnum =
                Text.Select(key, {"A".."Z","a".."z","0".."9","_"}) = key,

            hasAlpha =
                List.NonNullCount(
                    List.Select(
                        Text.ToList(key),
                        each _ >= "a" and _ <= "z"
                        or _ >= "A" and _ <= "Z"
                    )
                ) > 0,

            noUnderscoreEdge =
                not Text.StartsWith(key, "_")
                and not Text.EndsWith(key, "_")

        in
            isAlnum and hasAlpha and noUnderscoreEdge,

    // Step 6: Filter valid keys
    FilterValidKeys =
        Table.AddColumn(
            SplitParamAndTagKeys,
            "FilteredKeys",
            each
                [
                    ParamKeys =
                        List.Select(
                            [ParamAndTagKeys][ParamKeys],
                            each IsValidKey(_) and _ <> "tags"
                        ),

                    TagKeys =
                        List.Select(
                            [ParamAndTagKeys][TagKeys],
                            each IsValidKey(_)
                        )
                ]
        ),

    // Step 7: Combine keys with type labels
    CombineKeysWithType =
        Table.AddColumn(
            FilterValidKeys,
            "KeysWithType",
            each
                let
                    paramKeys =
                        List.Transform(
                            [FilteredKeys][ParamKeys],
                            each [Key = _, Type = "param"]
                        ),

                    tagKeys =
                        List.Transform(
                            [FilteredKeys][TagKeys],
                            each [Key = _, Type = "tag"]
                        )
                in
                    List.Combine({paramKeys, tagKeys})
        ),

    // Step 8: Expand keys into rows
    ExpandToRows =
        Table.ExpandListColumn(
            CombineKeysWithType,
            "KeysWithType"
        ),

    // Step 9: Expand record columns
    ExpandKeyAndType =
        Table.ExpandRecordColumn(
            ExpandToRows,
            "KeysWithType",
            {"Key", "Type"},
            {"parameter_name", "key_type"}
        )

in
    ExpandKeyAndType
```

---

## Output

The final dataset contains one row per detected parameter.

| date | page_location | parameter_name | key_type |
|-----|-----|-----|-----|
| 2026-03-10 | /search?q=laptop | q | param |
| 2026-03-10 | /search?... | source | param |
| 2026-03-10 | /search?... | brand | tag |

This structure enables downstream analysis of:

• parameter usage frequency  
• tracking coverage  
• anomaly detection in parameter behavior
