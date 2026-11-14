# Features

Business logic for builtin features that don’t have a particular reason to fit into another place (like serverboard or leveling which fit into database).

From a MVC perspective this is pretty much a `controllers/` directory.

All files export a single method with the name of the feature.

## Input types

All features take a single object with named arguments. These obviously differ from one feature to another, though similar/identical features are named consistently.

## Return types

Features return the `FeatureOutput<S, F>` type.

`S` is whatever the feature promised you, inspect that yourself. `F` is, by default, this:

SHAPE A:

```ts
type F = {
  title: string;
  reason: string;
}; // yes, you can just pass { ...failure.out } to errorEmbed()
```

Note that this is actually wrapped in a result object:

```ts
type FeatureOutput<
  S,
  F = {
    title: string;
    reason: string;
  },
> =
  | {
      success: true;
      feature: string;
      out: S;
    }
  | {
      success: false;
      feature: string;
      reason: "exception" | "user";
      out: F;
    };

// use literal value of `success` to discriminate the type of "out"
```

As you’d expect, `reason` tells you if the error is a user/setting/input/whatever error that should be shown to them, or an exception that should also be reported to us.

Features should be _Interkorable_ features, as it’s required to always return neutral data that can be used to build both a Container or an HTTP response. This doesn’t mean that all features _will_ be used by Interkora, some features only exist on Discord, yet they’re here.
