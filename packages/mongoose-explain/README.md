# mongoose-explain

A [mongoose](https://mongoosejs.com/) plugin for logging `.explain()` output of queries

## Installation

```sh
npm install --save @ghostjs/mongoose-explain

# OR

yarn add @ghostjs/mongoose-explain
```

## Usage

```typescript
import mongoose from 'mongoose';
import { explain } from '@ghostjs/mongoose-explain';

interface Data {
  someProp: string;
}

const schema = new mongoose.Schema<Data>({
  someProp: String
});

schema.plugin(explain({
  // optional options...
}));
```

## License

This project is licensed under the MIT license, a copy of which can be found at [LICENSE](./LICENSE).
