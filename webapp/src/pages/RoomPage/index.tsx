import { useParams } from 'react-router-dom';
import type { getRoomParams } from '../../lib/routes';
import { trpc } from '../../lib/trpc'


export const RoomPage = () => {
  const { roomID } = useParams() as getRoomParams

  const { data, error, isLoading, isFetching, isError } = trpc.getRoom.useQuery({
    roomID: roomID
  })

  if (isLoading || isFetching) {
      return <span>Loading...</span>
  }

  if (isError) {
      return <span>Error: {error.message}</span>

  }

  if (!data.room){
    <span>Room not found</span>
  }


  return (
    <div>
      <h1>Room {roomID}</h1>
      <p>Temperature in the Room {data.room?.temperature}</p>
      <div>
        <table></table>
      </div>
    </div>
  );
};
