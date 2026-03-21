export const App = () => {
  const data = [
    { id: "id1", name: "Temp", description: "Temperature at the ..." },
    { id: "id2", name: "Rooms", description: "List of rooms ..." },
    { id: "id3", name: "Graphs", description: "Graphs of temperature ..." },
  ];

  return (
    <div>
      <h1>Dashboard</h1>
      {data.map((component) => {
        return (
          <div key={component.id}>
            <h2>{component.name}</h2>
            <p>{component.description}</p>
          </div>
        );
      })}
    </div>
  );
};
