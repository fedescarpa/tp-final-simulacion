db.cloudresources.find({ $and: [{size: { $ne: 0 }}, {size: { $ne: NumberLong(0)}} , {size: { $ne: NumberLong(-1)}} ]}, { size: 1, _id: 0 }).forEach(function (u) { print(u.size); })
