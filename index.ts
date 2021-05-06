import "./style.css";
import {
  animationFrames,
  combineLatest,
  concat,
  config,
  connectable,
  defer,
  EMPTY,
  EmptyError,
  firstValueFrom,
  from,
  interval,
  lastValueFrom,
  merge,
  of,
  ReplaySubject,
  Subject,
  throwError,
  timer,
  zip
} from "rxjs";
import { fromFetch } from "rxjs/fetch";
import {
  combineLatestWith,
  concatAll,
  concatWith,
  connect,
  endWith,
  filter,
  first,
  groupBy,
  map,
  mergeMap,
  mergeWith,
  raceWith,
  retry,
  share,
  take,
  takeWhile,
  tap,
  timeout,
  zipWith
} from "rxjs/operators";

/* Better types */

// Observable<string, number>
of(0, "A", 1, "B", 2, "C", 3, "D", 4, "E", 5, "F", 6, "G", 7, "H", 8, "I", 9, "...")
  .pipe(
    groupBy((x): x is number => typeof x === "number"),
    mergeMap(group$ => (group$.key === true ? group$.pipe(map(String)) : group$))
  )
  .subscribe();
// Observable<string>

// Observable<"" | 0 | null | undefined | Date>
of("" as const, 0 as const, null, undefined, new Date())
  .pipe(filter(Boolean))
  .subscribe();
// Observable<Date>

const number$ = new Subject<number>();
number$.next(0); // delete 0 to see the error

/* fromFetch selector */

of(1, 2, 3)
  .pipe(
    map(id =>
      fromFetch(`https://jsonplaceholder.typicode.com/todos/${id}`, {
        selector: resp => resp.json()
      })
    ),
    concatAll()
  )
  .subscribe(todo => console.log(todo.title));
// (after some time) delectus aut autem
// (after some time) quis ut nam facilis et officia qui
// (after some time) fugiat veniam minus

/* toPromise → firstValueFrom, lastValueFrom */

const count1to5$ = interval(1000).pipe(
  take(5),
  map(i => i + 1)
);

firstValueFrom(count1to5$).then(console.log);
// (after ~1s) 1

lastValueFrom(count1to5$).then(console.log);
// (after ~5s) 5

lastValueFrom(EMPTY).catch(console.log);
// (asynchronously) EmptyErrorImpl

lastValueFrom(EMPTY).catch(err => console.log(err instanceof EmptyError));
// (asynchronously) true

/* combineLatest */
const count6to9$ = interval(1000).pipe(
  take(4),
  map(i => i + 6)
);

combineLatest({ x: count1to5$, y: count6to9$ }).subscribe(console.log);
// (after ~1s) {x: 1, y: 6}
// (after ~1s) {x: 2, y: 6} (immediately) {x: 2, y: 7}
// (after ~1s) {x: 3, y: 7} (immediately) {x: 3, y: 8}
// (after ~1s) {x: 4, y: 8} (immediately) {x: 4, y: 9}
// (after ~1s) {x: 5, y: 9}

/* combineLatestWith */

count1to5$.pipe(combineLatestWith(count6to9$)).subscribe(console.log);
// (after ~1s) [1,6]
// (after ~1s) [2,6] (immediately) [2,7]
// (after ~1s) [3,7] (immediately) [3,8]
// (after ~1s) [4,8] (immediately) [4,9]
// (after ~1s) [5,9]

/* mergeWith */

count1to5$.pipe(mergeWith(count6to9$)).subscribe(console.log);
// (after ~1s) 1 (immediately) 6
// (after ~1s) 2 (immediately) 7
// (after ~1s) 3 (immediately) 8
// (after ~1s) 4 (immediately) 9
// (after ~1s) 5

/* zipWith */

count1to5$.pipe(zipWith(count6to9$)).subscribe(console.log);
// (~1s apart) [1,6], [2,7], [3,8], [4,9]

/* raceWith */

count1to5$.pipe(raceWith(count6to9$)).subscribe(console.log);
// (~1s apart) 1, 2, 3, 4, 5

/* concatWith */

count1to5$.pipe(concatWith(count6to9$)).subscribe(console.log);
// (~1s apart) 1, 2, 3, 4, 5, 6, 7, 8, 9

/* Improved timeout */

const count$ = timer(3000, 2000);

count$
  .pipe(timeout({ first: 5000, each: 1000 }))
  .subscribe({ next: console.log, error: console.error });
// (after ~3s) 0
// (after ~1s) Error: Timeout has occurred

timer(5000, 1000)
  .pipe(timeout({ first: 2000, with: _ => of("timeout") }))
  .subscribe(console.log);
// (after ~1s) timeout

/* Retry reset counter */

const values = ["_", 0, 1, 0, 2, 0, 3, 0, 0, 0, 4];
defer(() => {
  values.shift();
  return from(values);
})
  .pipe(
    tap(i => {
      if (!i) throw "ERROR";
    }),
    retry({ count: 2, resetOnSuccess: true })
  )
  .subscribe({ next: console.log, error: console.warn });
// (synchronously) 1, 2, 3, ERROR

/* share configuration */

const shared$ = zip(interval(1000), of("A", "B", "C", "D", "E")).pipe(
  map(([, char]) => char),
  share({
    connector: () => new ReplaySubject(3),
    resetOnComplete: false,
    resetOnError: false,
    resetOnRefCountZero: false
  })
);

shared$.subscribe(console.log);
// (~1s apart) A, B, C, D, E

setTimeout(() => shared$.subscribe(console.log), 6000);
// (after ~6s, all at once) C, D, E

/* connect */

const chars$ = of("A", "b", "C", "D", "e", "f", "G");

chars$
  .pipe(
    connect(shared$ =>
      merge(
        shared$.pipe(
          filter(x => x.toLowerCase() === x),
          map(x => `lower ${x.toUpperCase()}`)
        ),
        shared$.pipe(
          filter(x => x.toLowerCase() !== x),
          map(x => `upper ${x}`)
        )
      )
    )
  )
  .subscribe(console.log);
// (synchronously) upper A
// (synchronously) lower B
// (synchronously) upper C
// (synchronously) upper D
// (synchronously) lower E
// (synchronously) lower F
// (synchronously) upper G

/* connectable */

const connectableChars$ = connectable(chars$);

const lower$ = connectableChars$.pipe(
  filter(x => x.toLowerCase() === x),
  map(x => `lower ${x.toUpperCase()}`)
);
const upper$ = connectableChars$.pipe(
  filter(x => x.toLowerCase() !== x),
  map(x => `upper ${x}`)
);

merge(lower$, upper$).subscribe(console.log);

connectableChars$.connect();
// (synchronously) upper A
// (synchronously) lower B
// (synchronously) upper C
// (synchronously) upper D
// (synchronously) lower E
// (synchronously) lower F
// (synchronously) upper G

/* animationFrames */

const h1 = document.querySelector("h1")!;

combineLatest({
  x: tween(0, 200, 3600),
  y: wave(25, 1200, 3)
}).subscribe(({ x, y }) => {
  h1.style.transform = `translate3d(${x}px, ${y}px, 0)`;
});

function tween(start: number, end: number, duration: number) {
  const delta = end - start;

  return animationFrames().pipe(
    map(({ elapsed }) => elapsed / duration),
    takeWhile(percentage => percentage < 1),
    endWith(1),
    map(percentage => percentage * delta + start)
  );
}

function wave(length: number, duration: number, repeat = 1) {
  const tweens = [
    tween(0, length, duration / 4),
    tween(length, -length, duration / 2),
    tween(-length, 0, duration / 4)
  ];

  const animation = Array(repeat)
    .fill(tweens)
    .flat();

  return concat(...animation);
}

/* config.onUnhandledError */

config.onUnhandledError = console.warn;
throwError(() => "TEST ERROR 1").subscribe();
throwError(() => "TEST ERROR 2").subscribe({ error: console.warn });
// (synchronously) TEST ERROR 2
// (asynchronously) TEST ERROR 1

/* Return of call stack to custom errors */

EMPTY.pipe(first()).subscribe({ error: console.warn });
// (synchronously) EmptyErrorImpl, with call stack
